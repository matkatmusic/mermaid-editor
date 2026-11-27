// declare const mermaid: any;
declare const mermaid: import('mermaid').Mermaid;
import { buildSourceWithMetadata, setEditorActionPromise } from '../../model/editor-metadata.ts';
import { codeBox, diagramBox, multiSelectBadge, nodeActions, selectedNodeBox } from '../../app/dom.ts';
import { state } from '../../app/state.ts';
import { render } from '../../views/main-diagram/render.ts';
import { saveDiagram } from '../file/diagram-save.ts';
// import { buildSourceWithHexagonDecisions } from './editor-parse.ts';
import { renderNodeInspector } from '../../views/inspector/node-inspector.ts';
import { renderSourceLines } from '../../views/editor-drawer/source-lines.ts';
import { refreshSearchMatches } from '../navigation/node-search.ts';

export async function applyEditorSource(source: string, options?: { recordHistory?: boolean }) {
  source = buildSourceWithMetadata(source);
  await mermaid.parse(source);
  codeBox.value = source;
  const recordHistory = options?.recordHistory !== false;
  if (recordHistory) {
    state.editorHistory = state.editorHistory.slice(0, state.editorHistoryIndex + 1);
    state.editorHistory.push(source);
    state.editorHistoryIndex = state.editorHistory.length - 1;
  }
  await render();
  const hasSaveTarget = !!state.currentName || !!state.openedFileHandle || !!state.loadedPath;
  if (!hasSaveTarget)
    throw new Error('No diagram file is loaded to auto-save into');
  await saveDiagram();
  refreshSearchMatches();
  // selectEditorNode(null);
  selectEditorNode(state.selectedEditorNodeId);
}

// Retired by task 87 change: both Q_X{"text"} (diamond) and Q_X{{"text"}} (hexagon) stay valid, so a load changes nothing.
// export async function rewriteDecisionsAsHexagons() {
//   const rewrittenSource = buildSourceWithHexagonDecisions(codeBox.value);
//   const isAlreadyHexagons = rewrittenSource === codeBox.value;
//   if (isAlreadyHexagons)
//     return;
//   await applyEditorSource(rewrittenSource);
// }

function clearFailedAction() {}

export function appendEditorAction(action: () => Promise<void>) {
  // A rejected action must not permanently block every action queued after it.
  setEditorActionPromise(state.editorActionPromise.catch(clearFailedAction).then(action));
}

export function executeEditorAction(action: () => Promise<void>) {
  appendEditorAction(action);
}

export function selectEditorNode(id: string | null) {
  state.selectedEditorNodeId = id;
  state.multiSelectedNodeIds = [];
  if (state.advanceAfterDecisionText?.decisionId !== id)
    state.advanceAfterDecisionText = null;
  if (state.focusDestinationAfterTextId !== id)
    state.focusDestinationAfterTextId = null;
  state.pendingRemoval = null;
  nodeActions.classList.remove('removing');
  nodeActions.classList.toggle('open', !!id);
  selectedNodeBox.textContent = id ?? '';
  renderSourceLines();
  renderEditorSelection();
  renderNodeInspector();
}

export function renderEditorSelection() {
  for (const el of diagramBox.querySelectorAll('.editor-selected'))
    el.classList.remove('editor-selected');
  for (const el of diagramBox.querySelectorAll('.editor-preview'))
    el.classList.remove('editor-preview');
  multiSelectBadge.hidden = state.multiSelectedNodeIds.length < 2;
  multiSelectBadge.textContent = `selected: ${state.multiSelectedNodeIds.length} nodes`;
  const selectedIds = state.selectedEditorNodeId ? [state.selectedEditorNodeId] : state.multiSelectedNodeIds;
  for (const selectedId of selectedIds) {
    const el = diagramBox.querySelector('[id*="flowchart-' + selectedId + '-"]');
    if (el)
      el.classList.add('editor-selected');
  }
  if (state.pendingRemoval) {
    const target = state.pendingRemoval.choices[state.pendingRemoval.index];
    const el = diagramBox.querySelector('[id*="flowchart-' + target + '-"]');
    if (el)
      el.classList.add('editor-preview');
  }
}

export function renderRemovalPreview() {
  renderEditorSelection();
  renderNodeInspector();
}

