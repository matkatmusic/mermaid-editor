export type NodeNote = { id: string; text: string };

const NOTE_LINE_PATTERN = /^%% ==note:\[([A-Za-z0-9_]+)\]==:(.*)$/;

export function parseNoteLine(line: string): NodeNote | null {
    const match = line.trim().match(NOTE_LINE_PATTERN);
    if (!match)
        return null;
    return { id: match[1], text: match[2].trim() };
}

// The editor writes the note in the props line; parseNoteLine stays so file-format.ts can read old files.
// export function buildNoteLine(id: string, noteText: string) {
//     return `%% ==note:[${id}]==: ${noteText}`;
// }
