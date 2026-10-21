import { classesMenuBtn, codeBox, destinationRow, nodeActions, nodeClassRow, nodeInspectorActions, nodeInspectorRemovalPreview, nodeTextInput, openFileBtn, phoneDiagramBox, selectBox } from './dom.ts';
import type { Edge } from './dom.ts';
import { parseEdges } from './diagram-source.ts';
import { setStatus } from './diagram-io.ts';
import { state } from './state.ts';
import { findRoot } from './phone-render.ts';
import { buildChosenPathSource } from './path-export.ts';
import { selectPathFolder, writeToOpenedFileFolder, writeToServerDiagrams } from './path-write.ts';

// Depth first: each edge is used once per path; a path ends where no unused edge leaves the node.
function collectPaths(path: string[], usedEdges: Set<string>, edges: Edge[], paths: string[][]) {
  const current = path[path.length - 1];
  let hasUnusedEdge = false;
  for (const [from, to] of edges) {
    const edgeKey = `${from}->${to}`;
    const isUnusedOutgoing = from === current && !usedEdges.has(edgeKey);
    if (!isUnusedOutgoing)
      continue;
    hasUnusedEdge = true;
    usedEdges.add(edgeKey);
    path.push(to);
    collectPaths(path, usedEdges, edges, paths);
    path.pop();
    usedEdges.delete(edgeKey);
  }
  if (!hasUnusedEdge)
    paths.push([...path]);
}

export function listAllPathIds(edges: Edge[]): string[][] {
  const paths: string[][] = [];
  const root = findRoot(edges);
  if (root === undefined)
    return paths;
  collectPaths([root], new Set(), edges, paths);
  return paths;
}

export async function writeAllPaths() {
  const sources: string[] = [];
  for (const ids of listAllPathIds(parseEdges(codeBox.value)))
    sources.push(buildChosenPathSource(ids));
  if (state.currentName) {
    setStatus(`Writing 0/${sources.length} paths`);
    for (let writtenCount = 1; writtenCount <= sources.length; writtenCount++) {
      await writeToServerDiagrams(state.currentName, sources[writtenCount - 1]);
      setStatus(`Writing ${writtenCount}/${sources.length} paths`);
    }
  }
  else {
    const openedFileName = state.openedFileHandle?.name ?? state.loadedPath?.split('/').pop();
    if (!openedFileName)
      throw new Error('Save the diagram before exporting all paths');
    const hasFolder = await selectPathFolder();
    if (!hasFolder) {
      console.log('User canceled Export all paths');
      return;
    }
    setStatus(`Writing 0/${sources.length} paths`);
    for (let writtenCount = 1; writtenCount <= sources.length; writtenCount++) {
      await writeToOpenedFileFolder(openedFileName, sources[writtenCount - 1]);
      setStatus(`Writing ${writtenCount}/${sources.length} paths`);
    }
  }
  setStatus(`Wrote ${sources.length} paths`);
}

function disableDiagramEdits() {
  (document.getElementById('newBtn') as HTMLButtonElement).disabled = true;
  (openFileBtn as HTMLButtonElement).disabled = true;
  selectBox.disabled = true;
  (classesMenuBtn as HTMLButtonElement).disabled = true;
  (document.getElementById('editorUndoBtn') as HTMLButtonElement).disabled = true;
  (document.getElementById('editorRedoBtn') as HTMLButtonElement).disabled = true;
  nodeActions.inert = true;
  nodeTextInput.inert = true;
  nodeClassRow.inert = true;
  nodeInspectorActions.inert = true;
  destinationRow.inert = true;
  nodeInspectorRemovalPreview.inert = true;
  phoneDiagramBox.classList.add('writing-all-paths');
  codeBox.readOnly = true;
  (document.getElementById('exportAllPathsBtn') as HTMLButtonElement).disabled = true;
}

function enableDiagramEdits() {
  (document.getElementById('newBtn') as HTMLButtonElement).disabled = false;
  (openFileBtn as HTMLButtonElement).disabled = false;
  selectBox.disabled = false;
  (classesMenuBtn as HTMLButtonElement).disabled = false;
  (document.getElementById('editorUndoBtn') as HTMLButtonElement).disabled = false;
  (document.getElementById('editorRedoBtn') as HTMLButtonElement).disabled = false;
  nodeActions.inert = false;
  nodeTextInput.inert = false;
  nodeClassRow.inert = false;
  nodeInspectorActions.inert = false;
  destinationRow.inert = false;
  nodeInspectorRemovalPreview.inert = false;
  phoneDiagramBox.classList.remove('writing-all-paths');
  codeBox.readOnly = false;
  (document.getElementById('exportAllPathsBtn') as HTMLButtonElement).disabled = false;
}

async function writeAllPathsWithEditsDisabled() {
  disableDiagramEdits();
  try {
    await writeAllPaths();
  }
  finally {
    enableDiagramEdits();
  }
}

document.getElementById('exportAllPathsBtn')!.addEventListener('click', writeAllPathsWithEditsDisabled);
