import { parseEditorGraph } from './editor-graph-parse.ts';
import { encodeLabelLineBreaks } from './editor-parse.ts';
import { parseAlignLine } from './node-align.ts';
import { parseNoteLine } from './node-note.ts';
import { buildSourceWithNodeProps } from './node-props.ts';
import type { NodeProps } from './node-props.ts';
import { parseSizeLine } from './node-size.ts';

export const FILE_FORMAT_VERSION = 2;
// The first note format: no block id, so the line counts only when it sits directly above a declaration.
const POSITIONAL_NOTE_PREFIX = '%% ==note==:';

// Turns the old size, align and note lines into one props line per block.
export function buildSourceWithPropsLines(source: string) {
    const { graph } = parseEditorGraph(source);
    const positionalNoteOwners = new Map<number, string>();
    for (const node of graph.nodes.values()) {
        for (let i = node.lineIndex - 1; i >= 0 && graph.lines[i].trim().startsWith(POSITIONAL_NOTE_PREFIX); i--)
            positionalNoteOwners.set(i, node.id);
    }
    const changesById = new Map<string, Partial<NodeProps>>();
    const noteLinesById = new Map<string, string[]>();
    const keptLines: string[] = [];
    function addChanges(id: string, changes: Partial<NodeProps>) {
        changesById.set(id, { ...changesById.get(id), ...changes });
    }
    function addNoteLine(id: string, text: string) {
        noteLinesById.set(id, [...noteLinesById.get(id) ?? [], text]);
    }
    for (let lineIndex = 0; lineIndex < graph.lines.length; lineIndex++) {
        const line = graph.lines[lineIndex];
        const ownerId = positionalNoteOwners.get(lineIndex);
        if (ownerId) {
            addNoteLine(ownerId, line.trim().slice(POSITIONAL_NOTE_PREFIX.length).trim());
            continue;
        }
        const note = parseNoteLine(line);
        if (note) {
            addNoteLine(note.id, note.text);
            continue;
        }
        const size = parseSizeLine(line);
        if (size) {
            addChanges(size.id, { width: size.width, height: size.height });
            continue;
        }
        const align = parseAlignLine(line);
        if (align) {
            addChanges(align.id, { alignment: align.alignment, justification: align.justification });
            continue;
        }
        keptLines.push(line);
    }
    for (const [id, noteLines] of noteLinesById) {
        const joined = noteLines.join('\n');
        const noteText = encodeLabelLineBreaks(joined, joined);
        if (noteText)
            addChanges(id, { note: noteText });
    }
    let convertedSource = keptLines.join('\n');
    for (const [id, changes] of changesById)
        convertedSource = buildSourceWithNodeProps(convertedSource, id, changes);
    return convertedSource;
}
