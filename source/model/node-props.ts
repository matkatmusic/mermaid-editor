import { PROPS_PREFIX } from './editor-types.ts';
import type { Alignment, Justification } from './node-align.ts';

export interface NodeProps {
    blockId: string;
    alignment?: Alignment;
    justification?: Justification;
    width?: number;
    height?: number;
    note?: string;
}

export function parsePropsLine(line: string): NodeProps | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith(PROPS_PREFIX))
        return null;
    // return JSON.parse(trimmed.slice(PROPS_PREFIX.length));
    return JSON.parse(trimmed.slice(PROPS_PREFIX.length)) as NodeProps;
}

// The keys are named one by one so every line has the same key order; JSON leaves out an undefined value.
export function buildPropsLine({ blockId, alignment, justification, width, height, note }: NodeProps) {
    return `${PROPS_PREFIX} ${JSON.stringify({ blockId, alignment, justification, width, height, note })}`;
}

export function getNodeProps(lines: string[], id: string): NodeProps {
    for (const line of lines) {
        const props = parsePropsLine(line);
        if (props?.blockId === id)
            return props;
    }
    return { blockId: id };
}

// The one function that writes a props line. An undefined value in `changes` takes that field away.
export function buildSourceWithNodeProps(source: string, id: string, changes: Partial<NodeProps>) {
    const lines = source.split('\n');
    const props: NodeProps = { ...getNodeProps(lines, id), ...changes };
    const keptLines: string[] = [];
    for (const line of lines) {
        const isOldLineOfNode = parsePropsLine(line)?.blockId === id;
        if (!isOldLineOfNode)
            keptLines.push(line);
    }
    const hasNoFields = buildPropsLine(props) === buildPropsLine({ blockId: id });
    if (hasNoFields)
        return keptLines.join('\n');
    const declarationPattern = new RegExp(`^\\s*${id}[\\[{(]`);
    const declarationIndex = keptLines.findIndex((line) => declarationPattern.test(line));
    // A block that is not declared keeps its values at the end, where the parser reports the line.
    if (declarationIndex === -1)
        return [...keptLines, buildPropsLine(props)].join('\n');
    const indent = keptLines[declarationIndex].match(/^\s*/)![0];
    keptLines.splice(declarationIndex, 0, `${indent}${buildPropsLine(props)}`);
    return keptLines.join('\n');
}
