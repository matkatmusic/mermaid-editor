import { SIZE_PREFIX } from './editor-types.ts';

// Mermaid draws a rectangle this much bigger than its label; node-size.test.ts and tests/node-size.test.ts pin both numbers.
export const NODE_PADDING_WIDTH = 32;
export const NODE_PADDING_HEIGHT = 24;
// A hexagon decision is drawn this much higher than its label, and its two points add this fraction of the outer height to the outer width.
// Measured with tests/node-resize-hexagon.test.ts: outer width = label width + 32 + 4/7 * outer height.
export const HEXAGON_PADDING_HEIGHT = 70;
export const HEXAGON_POINTS_WIDTH_RATIO = 4 / 7;

export type NodeSize = { id: string; width: number; height: number };

const SIZE_LINE_PATTERN = /^%% ==size==: ([A-Za-z0-9_]+) (\d+) (\d+)$/;
const DECLARATION_PATTERN = /^(\s*)([A-Za-z0-9_]+)(\[|\{\{)"(.*)"(\]|\}\})\s*$/;

export function parseSizeLine(line: string): NodeSize | null {
    const match = line.trim().match(SIZE_LINE_PATTERN);
    if (!match)
        return null;
    return { id: match[1], width: Number(match[2]), height: Number(match[3]) };
}

export function buildSizeLine(id: string, width: number, height: number) {
    return `${SIZE_PREFIX} ${id} ${width} ${height}`;
}

export function buildSourceWithoutNodeSize(source: string, id: string) {
    const keptLines: string[] = [];
    for (const line of source.split('\n')) {
        const size = parseSizeLine(line);
        const isOldLineOfNode = size?.id === id;
        if (!isOldLineOfNode)
            keptLines.push(line);
    }
    return keptLines.join('\n');
}

// The one function that sets a node's size; the drag resize of tasks 89 and 90 calls it too.
export function buildSourceWithNodeSize(source: string, id: string, width: number, height: number) {
    const body = buildSourceWithoutNodeSize(source, id).replace(/\s+$/, '');
    return `${body}\n${buildSizeLine(id, width, height)}`;
}

// Only the render path uses this text. The wrapper makes Mermaid lay the node out at the stored size:
// width is at least 25 "0" characters (ch) and height at least 2 text rows (lh); taller text grows the node.
export function buildSourceWithSizeWrappers(source: string) {
    const lines = source.split('\n');
    const sizes = new Map<string, NodeSize>();
    for (const line of lines) {
        const size = parseSizeLine(line);
        if (size)
            sizes.set(size.id, size);
    }
    if (sizes.size === 0)
        return source;
    const wrappedLines: string[] = [];
    for (const line of lines) {
        const declaration = line.match(DECLARATION_PATTERN);
        if (!declaration) {
            wrappedLines.push(line);
            continue;
        }
        const size = sizes.get(declaration[2]);
        if (!size) {
            wrappedLines.push(line);
            continue;
        }
        const [, indent, id, open, label, close] = declaration;
        const isHexagon = open === '{{';
        let wrapperWidth = size.width - NODE_PADDING_WIDTH;
        let wrapperHeight = size.height - NODE_PADDING_HEIGHT;
        if (isHexagon) {
            wrapperWidth = Number((size.width - NODE_PADDING_WIDTH - HEXAGON_POINTS_WIDTH_RATIO * size.height).toFixed(2));
            wrapperHeight = size.height - HEXAGON_PADDING_HEIGHT;
        }
        const style = `display:flex;align-items:center;justify-content:center;width:max(${wrapperWidth}px,25ch);min-height:max(${wrapperHeight}px,2lh)`;
        wrappedLines.push(`${indent}${id}${open}"<div style='${style}'><div>${label}</div></div>"${close}`);
    }
    return wrappedLines.join('\n');
}
