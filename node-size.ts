import { getNodeAlign } from './node-align.ts';
import { buildSourceWithNodeProps, parsePropsLine } from './node-props.ts';
import type { Alignment, Justification, NodeAlign } from './node-align.ts';

// Mermaid (look "neo") draws a rectangle 16 px per side wider and 12 px per side higher than its label, and a hexagon 16 px per side wider and 35 px per side higher.
// Every label gets a negative margin that takes all of that back except TEXT_PADDING, so a block is its text box plus TEXT_PADDING on each side.
const TEXT_PADDING = 4;
const MERMAID_PADDING_X = 16;
const MERMAID_RECT_PADDING_Y = 12;
const MERMAID_HEXAGON_PADDING_Y = 35;
// Mermaid measures a label as 0 px high at the least, and the hexagon text sits off-centre when the margins push it below 0.
// 11 px per side keeps a one-line label (24 px) at 2 px or more.
const HEXAGON_LABEL_MARGIN_Y = 11;
export const LABEL_MARGIN_X = MERMAID_PADDING_X - TEXT_PADDING;
const RECT_LABEL_MARGIN = `-${MERMAID_RECT_PADDING_Y - TEXT_PADDING}px -${LABEL_MARGIN_X}px`;
const HEXAGON_LABEL_MARGIN = `-${HEXAGON_LABEL_MARGIN_Y}px -${LABEL_MARGIN_X}px`;
// The outer box of a block is its text box plus this much; node-size.test.ts and tests/node-size.test.ts pin both numbers.
export const NODE_PADDING_WIDTH = 2 * TEXT_PADDING;
export const NODE_PADDING_HEIGHT = 2 * TEXT_PADDING;
// A hexagon decision is drawn this much higher than its text box, and its two points add this fraction of the outer height to the outer width.
// Measured with tests/node-resize-hexagon.test.ts: outer width = text box width + NODE_PADDING_WIDTH + 4/7 * outer height.
export const HEXAGON_PADDING_HEIGHT = 2 * (MERMAID_HEXAGON_PADDING_Y - HEXAGON_LABEL_MARGIN_Y);
export const HEXAGON_POINTS_WIDTH_RATIO = 4 / 7;

export type NodeSize = { id: string; width: number; height: number };

const FLEX_JUSTIFY_CONTENT: Record<Justification, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };
const FLEX_ALIGN_ITEMS: Record<Alignment, string> = { top: 'flex-start', center: 'center', bottom: 'flex-end' };

const SIZE_LINE_PATTERN = /^%% ==size==: ([A-Za-z0-9_]+) (\d+) (\d+)$/;
const DECLARATION_PATTERN = /^(\s*)([A-Za-z0-9_]+)(\[|\{\{)"(.*)"(\]|\}\})\s*$/;

export function parseSizeLine(line: string): NodeSize | null {
    const match = line.trim().match(SIZE_LINE_PATTERN);
    if (!match)
        return null;
    return { id: match[1], width: Number(match[2]), height: Number(match[3]) };
}

// export function buildSizeLine(id: string, width: number, height: number) {
//     return `${SIZE_PREFIX} ${id} ${width} ${height}`;
// }

export function buildSourceWithoutNodeSize(source: string, id: string) {
    // const keptLines: string[] = [];
    // for (const line of source.split('\n')) {
    //     const size = parseSizeLine(line);
    //     const isOldLineOfNode = size?.id === id;
    //     if (!isOldLineOfNode)
    //         keptLines.push(line);
    // }
    // return keptLines.join('\n');
    return buildSourceWithNodeProps(source, id, { width: undefined, height: undefined });
}

// The one function that sets a node's size; the drag resize of tasks 89 and 90 calls it too.
export function buildSourceWithNodeSize(source: string, id: string, width: number, height: number) {
    // const body = buildSourceWithoutNodeSize(source, id).replace(/\s+$/, '');
    // return `${body}\n${buildSizeLine(id, width, height)}`;
    return buildSourceWithNodeProps(source, id, { width, height });
}

// Only the render path uses this text. The wrapper makes Mermaid lay the node out at the stored size:
// width is at least 25 "0" characters (ch) and height at least 2 text rows (lh); taller text grows the node.
export function buildSourceWithSizeWrappers(source: string) {
    const lines = source.split('\n');
    const sizes = new Map<string, NodeSize>();
    // for (const line of lines) {
    //     const size = parseSizeLine(line);
    //     if (size)
    //         sizes.set(size.id, size);
    // }
    const aligns = new Map<string, NodeAlign>();
    // for (const line of lines) {
    //     const align = parseAlignLine(line);
    //     if (align)
    //         aligns.set(align.id, align);
    // }
    for (const line of lines) {
        const props = parsePropsLine(line);
        if (!props)
            continue;
        const id = props.blockId;
        if (props.width !== undefined) {
            if (props.height !== undefined)
                sizes.set(id, { id, width: props.width, height: props.height });
        }
        aligns.set(id, getNodeAlign([line], id));
    }
    // if (sizes.size === 0 && aligns.size === 0)
    //     return source;
    const wrappedLines: string[] = [];
    for (const line of lines) {
        const declaration = line.match(DECLARATION_PATTERN);
        if (!declaration) {
            wrappedLines.push(line);
            continue;
        }
        const size = sizes.get(declaration[2]);
        const align = aligns.get(declaration[2]);
        const [, indent, id, open, label, close] = declaration;
        const isHexagon = open === '{{';
        const labelMargin = isHexagon ? HEXAGON_LABEL_MARGIN : RECT_LABEL_MARGIN;
        if (!size) {
            // Without a size line the label is as big as its text, so only the justification of its lines can show.
            let style = `margin:${labelMargin}`;
            if (align) {
                if (align.justification !== 'center')
                    style += `;text-align:${align.justification}`;
            }
            wrappedLines.push(`${indent}${id}${open}"<div style='${style}'>${label}</div>"${close}`);
            continue;
        }
        let wrapperWidth = size.width - NODE_PADDING_WIDTH;
        let wrapperHeight = size.height - NODE_PADDING_HEIGHT;
        if (isHexagon) {
            wrapperWidth = Number((size.width - NODE_PADDING_WIDTH - HEXAGON_POINTS_WIDTH_RATIO * size.height).toFixed(2));
            wrapperHeight = size.height - HEXAGON_PADDING_HEIGHT;
        }
        const justification = align?.justification ?? 'center';
        const alignment = align?.alignment ?? 'center';
        const style = `display:flex;align-items:${FLEX_ALIGN_ITEMS[alignment]};justify-content:${FLEX_JUSTIFY_CONTENT[justification]};width:max(${wrapperWidth}px,25ch);min-height:max(${wrapperHeight}px,2lh);white-space:normal;margin:${labelMargin}`;
        const labelOpen = justification === 'center' ? '<div>' : `<div style='text-align:${justification}'>`;
        wrappedLines.push(`${indent}${id}${open}"<div style='${style}'>${labelOpen}${label}</div></div>"${close}`);
    }
    return wrappedLines.join('\n');
}
