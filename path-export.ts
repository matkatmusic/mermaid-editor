import { codeBox } from './dom.ts';
import { parseEdges } from './diagram-source.ts';
import { declarationSuffixOf, editorGraph } from './editor-graph.ts';
import { buildHistoryRows } from './phone-render.ts';
import { setStatus } from './diagram-io.ts';
import { state } from './state.ts';
import { buildClassStyleIndex } from './class-defs.ts';
import type { EditorGraph } from './editor-types.ts';

// Node ids the phone history shows, in order; choices that were not taken are left out.
export function getChosenPathIds(): string[] {
  const rows = buildHistoryRows(parseEdges(codeBox.value), editorGraph());
  const ids: string[] = [];
  for (const row of rows) {
    const isAlreadyListed = ids[ids.length - 1] === row.id;
    if (!isAlreadyListed)
      ids.push(row.id);
    const isAnsweredDecision = row.status === 'past';
    if (isAnsweredDecision)
      ids.push(row.chosenChoiceId);
  }
  return ids;
}

function getPlainLabel(id: string, graph: EditorGraph) {
  return graph.nodes.get(id)!.label.replace(/<br\s*\/?>/gi, ' ');
}

// One "%% question -> chosen answer" line per decision, for the top of the path file.
function buildDecisionComment(ids: string[], graph: EditorGraph): string[] {
  const lines = ['%% Decisions made:'];
  for (let i = 0; i + 1 < ids.length; i++) {
    const isDecision = graph.nodes.get(ids[i])!.kind === 'question';
    if (!isDecision)
      continue;
    lines.push(`%%   ${getPlainLabel(ids[i], graph)} -> ${getPlainLabel(ids[i + 1], graph)}`);
  }
  const hasNoDecisions = lines.length === 1;
  if (hasNoDecisions)
    lines.push('%%   none');
  return lines;
}

// Copies each used classDef line verbatim, then one class line per class for the path's nodes.
function buildClassLines(declaredIds: Set<string>): string[] {
  const classIndex = buildClassStyleIndex(codeBox.value);
  const idsByClass = new Map<string, string[]>();
  for (const id of declaredIds) {
    const className = classIndex.assignments.get(id);
    if (!className)
      continue;
    const classIds = idsByClass.get(className) ?? [];
    classIds.push(id);
    idsByClass.set(className, classIds);
  }
  const sourceLines = codeBox.value.split('\n');
  const lines: string[] = [];
  for (const [className, classIds] of idsByClass) {
    const classDef = classIndex.defsByName.get(className);
    if (classDef)
      lines.push(`  ${sourceLines[classDef.lineIndex].trim()}`);
    lines.push(`  class ${classIds.join(',')} ${className}`);
  }
  return lines;
}

export function buildChosenPathSource(ids: string[]): string {
  const graph = editorGraph();
  const lines = [...buildDecisionComment(ids, graph), 'flowchart TD'];
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
  lines.push(...buildClassLines(declaredIds));
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

export async function writeToServerDiagrams(diagramName: string, source: string) {
  const existingNames: string[] = await fetch('/api/diagrams').then(r => r.json());
  const fileName = findNextPathFileName(diagramName.replace(/\.mmd$/, ''), existingNames);
  const response = await fetch('/api/diagrams/' + encodeURIComponent(fileName), { method: 'PUT', body: source });
  if (!response.ok)
    throw new Error(`Writing ${fileName} failed: ${response.status} ${await response.text()}`);
  setStatus('Wrote ' + fileName);
}

// Chrome hides the opened file's folder, so ask for it once per opened file. False when canceled.
export async function selectPathFolder(): Promise<boolean> {
  if (state.pathFolderHandle)
    return true;
  try {
    state.pathFolderHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  }
  catch (error) {
    const isUserCancel = (error as DOMException).name === 'AbortError';
    if (!isUserCancel)
      throw error;
    return false;
  }
  return true;
}

export async function writeToOpenedFileFolder(openedFileName: string, source: string) {
  const hasFolder = await selectPathFolder();
  if (!hasFolder) {
    console.log('User canceled Write chosen path');
    return;
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
