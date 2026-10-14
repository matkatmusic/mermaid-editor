import { codeBox } from './dom.ts';
import { parseEdges } from './diagram-source.ts';
import { declarationSuffixOf, editorGraph } from './editor-graph.ts';
import { buildHistoryRows } from './phone-render.ts';
import { setStatus } from './diagram-io.ts';
import { state } from './state.ts';

// Node ids the phone history shows, in order; choices that were not taken are left out.
export function getChosenPathIds(): string[] {
  const rows = buildHistoryRows(parseEdges(codeBox.value), editorGraph());
  const ids: string[] = [];
  for (const row of rows) {
    ids.push(row.id);
    const isAnsweredDecision = row.status === 'past';
    if (isAnsweredDecision)
      ids.push(row.chosenChoiceId);
  }
  return ids;
}

export function buildChosenPathSource(ids: string[]): string {
  const graph = editorGraph();
  const lines = ['flowchart TD'];
  const declaredIds = new Set<string>();
  for (const id of ids) {
    const isDeclared = declaredIds.has(id);
    if (isDeclared)
      continue;
    declaredIds.add(id);
    lines.push(`  ${id}${declarationSuffixOf(graph.nodes.get(id)!)}`);
  }
  for (let i = 0; i + 1 < ids.length; i++)
    lines.push(`  ${ids[i]} --> ${ids[i + 1]}`);
  return lines.join('\n') + '\n';
}

// <base>-path-<N>.mmd, where N is one more than the highest N already in the folder (0 when none).
export function findNextPathFileName(baseName: string, existingNames: string[]): string {
  const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedBaseName}-path-(\\d+)\\.mmd$`);
  let nextNumber = 0;
  for (const name of existingNames) {
    const match = name.match(pattern);
    if (!match)
      continue;
    const usedNumber = Number(match[1]);
    if (usedNumber >= nextNumber)
      nextNumber = usedNumber + 1;
  }
  return `${baseName}-path-${nextNumber}.mmd`;
}

async function writeToServerDiagrams(diagramName: string, source: string) {
  const existingNames: string[] = await fetch('/api/diagrams').then(r => r.json());
  const fileName = findNextPathFileName(diagramName.replace(/\.mmd$/, ''), existingNames);
  const response = await fetch('/api/diagrams/' + encodeURIComponent(fileName), { method: 'PUT', body: source });
  if (!response.ok)
    throw new Error(`Writing ${fileName} failed: ${response.status} ${await response.text()}`);
  setStatus('Wrote ' + fileName);
}

async function writeToOpenedFileFolder(openedFileName: string, source: string) {
  // Chrome hides the opened file's folder, so ask for it once per opened file.
  if (!state.pathFolderHandle) {
    try {
      state.pathFolderHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    }
    catch (error) {
      const isUserCancel = (error as DOMException).name === 'AbortError';
      if (!isUserCancel)
        throw error;
      console.log('User canceled Write chosen path');
      return;
    }
  }
  const folder = state.pathFolderHandle!;
  const existingNames: string[] = [];
  for await (const name of (folder as any).keys())
    existingNames.push(name);
  const fileName = findNextPathFileName(openedFileName.replace(/\.mmd$/, ''), existingNames);
  const fileHandle = await folder.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(source);
  await writable.close();
  setStatus('Wrote ' + fileName);
}

export async function writeChosenPath() {
  const source = buildChosenPathSource(getChosenPathIds());
  if (state.currentName) {
    await writeToServerDiagrams(state.currentName, source);
    return;
  }
  if (!state.openedFileHandle)
    throw new Error('Save the diagram before writing a chosen path');
  await writeToOpenedFileFolder(state.openedFileHandle.name, source);
}
