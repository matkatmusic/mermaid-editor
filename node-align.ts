import { buildSourceWithNodeProps, getNodeProps } from './node-props.ts';

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
    return { id, justification: props.justification ?? 'center', alignment: props.alignment ?? 'center' };
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
    const isDefault = justification === 'center' && alignment === 'center';
    if (isDefault)
        return buildSourceWithoutNodeAlign(source, id);
    return buildSourceWithNodeProps(source, id, { justification, alignment });
}
