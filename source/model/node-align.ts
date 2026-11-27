import { buildSourceWithNodeProps, getNodeProps } from './node-props.ts';
import { decodeLabelQuotes } from './editor-parse.ts';
import { FENCED_CODE_BLOCK_PATTERN } from './label-code.ts';

export type Justification = 'left' | 'center' | 'right';
export type Alignment = 'top' | 'center' | 'bottom';
export type NodeAlign = { id: string; justification: Justification; alignment: Alignment };

const ALIGN_LINE_PATTERN = /^%% ==align==: ([A-Za-z0-9_]+) (left|center|right) (top|center|bottom)$/;

export function parseAlignLine(line: string): NodeAlign | null {
    const match = line.trim().match(ALIGN_LINE_PATTERN);
    if (!match)
        return null;
    return { id: match[1], justification: match[2] as Justification, alignment: match[3] as Alignment };
}

export function getNodeAlign(lines: string[], id: string): NodeAlign {
    // for (const line of lines) {
    //     const align = parseAlignLine(line);
    //     if (align?.id === id)
    //         return align;
    // }
    // return { id, justification: 'center', alignment: 'center' };
    const props = getNodeProps(lines, id);
    return { id, justification: props.justification ?? getDefaultJustification(lines, id), alignment: props.alignment ?? 'center' };
}

// The justification a block shows when its props line sets none: left for a block with a code fence.
export function getDefaultJustification(lines: string[], id: string): Justification {
    const labelPattern = new RegExp(`(?<![A-Za-z0-9_])${id}(?:\\[|\\{\\{)"([^"]*)"`);
    for (const line of lines) {
        if (line.trim().startsWith('%%'))
            continue;
        const declaration = line.match(labelPattern);
        if (!declaration)
            continue;
        const hasCodeFence = decodeLabelQuotes(declaration[1]).search(FENCED_CODE_BLOCK_PATTERN) !== -1;
        return hasCodeFence ? 'left' : 'center';
    }
    return 'center';
}

// export function buildAlignLine(id: string, justification: Justification, alignment: Alignment) {
//     return `${ALIGN_PREFIX} ${id} ${justification} ${alignment}`;
// }

export function buildSourceWithoutNodeAlign(source: string, id: string) {
    // const keptLines: string[] = [];
    // for (const line of source.split('\n')) {
    //     const align = parseAlignLine(line);
    //     const isOldLineOfNode = align?.id === id;
    //     if (!isOldLineOfNode)
    //         keptLines.push(line);
    // }
    // return keptLines.join('\n');
    return buildSourceWithNodeProps(source, id, { alignment: undefined, justification: undefined });
}

// The one function that sets a node's text alignment; centre and centre is the default, so it has no fields.
export function buildSourceWithNodeAlign(source: string, id: string, justification: Justification, alignment: Alignment) {
    // const sourceWithoutOldLine = buildSourceWithoutNodeAlign(source, id);
    // const isDefault = justification === 'center' && alignment === 'center';
    // if (isDefault)
    //     return sourceWithoutOldLine;
    // const body = sourceWithoutOldLine.replace(/\s+$/, '');
    // return `${body}\n${buildAlignLine(id, justification, alignment)}`;
    // A code fence block writes each value only when it differs from what the block shows without it.
    const isCodeFenceBlock = getDefaultJustification(source.split('\n'), id) === 'left';
    if (isCodeFenceBlock) {
        const writtenJustification = justification === 'left' ? undefined : justification;
        const writtenAlignment = alignment === 'center' ? undefined : alignment;
        return buildSourceWithNodeProps(source, id, { justification: writtenJustification, alignment: writtenAlignment });
    }
    const isDefault = justification === 'center' && alignment === 'center';
    if (isDefault)
        return buildSourceWithoutNodeAlign(source, id);
    return buildSourceWithNodeProps(source, id, { justification, alignment });
}
