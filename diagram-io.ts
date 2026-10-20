import { currentFileName, diagramBox, drawer, outputBox, selectBox, statusBox } from './dom.ts';
import { positionNodeInspector } from './node-inspector.ts';
import { state } from './state.ts';
import { selectEditorNode } from './editor-actions.ts';
import type { EditorGraph, EditorMetadata, EditorNode } from './editor-types.ts';

export function setStatus(text: string) {
  statusBox.textContent = text;
  function clearStatusIfUnchanged() {
    if (statusBox.textContent === text)
      statusBox.textContent = state.loadedPath ?? '';
  }
  setTimeout(clearStatusIfUnchanged, 2000);
}

export function setDrawerOpen(open: boolean) {
  drawer.classList.toggle('closed', !open);
  positionNodeInspector();
}

export async function loadList() {
  currentFileName.textContent = state.currentName ?? '';
  const listResponse = await fetch('/api/diagrams');
  const names = await listResponse.json();
  selectBox.innerHTML = '<option value="" disabled ' + (state.currentName ? '' : 'selected') + '>Diagrams</option>';
  for (const name of names) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    if (name === state.currentName)
      option.selected = true;
    selectBox.appendChild(option);
  }
}

export function resetEditorHistory(text: string) {
  state.editorHistory = [text];
  state.editorHistoryIndex = 0;
  selectEditorNode(null);
}

export function applyMainViewport(metadata: EditorMetadata | null, graph: EditorGraph) {
  const hasSavedLeft = typeof metadata?.outputScrollLeft === 'number';
  const hasSavedTop = typeof metadata?.outputScrollTop === 'number';
  if (hasSavedLeft)
    outputBox.scrollLeft = metadata.outputScrollLeft!;
  if (hasSavedTop)
    outputBox.scrollTop = metadata.outputScrollTop!;
  if (hasSavedLeft) {
    if (hasSavedTop)
      return;
  }
  const firstNode = graph.nodes.values().next().value as EditorNode | undefined;
  if (!firstNode)
    return;
  const node = diagramBox.querySelector('[id*="flowchart-' + firstNode.id + '-"]');
  if (!node)
    return;
  const outputRect = outputBox.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  const nodeLeft = outputBox.scrollLeft + nodeRect.left - outputRect.left;
  const nodeTop = outputBox.scrollTop + nodeRect.top - outputRect.top;
  if (!hasSavedLeft)
    outputBox.scrollLeft = Math.max(0, nodeLeft - 12);
  if (!hasSavedTop)
    outputBox.scrollTop = Math.max(0, nodeTop - 12);
}
