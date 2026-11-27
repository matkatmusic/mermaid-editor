import { codeBox, diagramBox, nextDecisionBtn, outputBox, previousDecisionBtn, searchInput, zoomInBtn, zoomOutBtn } from './dom.ts';
import { moveNodeToViewportCenter } from './decision-nav.ts';
import { state } from './state.ts';
import { saveEditorViewState } from './editor-view-state.ts';
import { applyEditorSource, executeEditorAction, selectEditorNode } from './editor-actions.ts';
import { parseEditorGraph } from './editor-graph-parse.ts';
import { applyEditorRedo, applyEditorUndo } from './editor-history.ts';
import { getSelectedNodeIds } from './editor-multiselect.ts';
import { refuseMoveWhileNodeNameIsInvalid } from './editor-rename.ts';
import { buildBlockRemovedSource, buildChoiceRemovedSource } from './editor-remove.ts';
import { buildQuestionRemovedSource } from './editor-remove-question.ts';
// import { refuseEditInPathView } from './path-view.ts';
import { isNodeDrawn, refuseEditInPathView } from './path-view.ts';

function isTextBoxTarget(target: EventTarget | null) {
  const element = target as HTMLElement;
  const isInput = element.tagName === 'INPUT';
  const isTextarea = element.tagName === 'TEXTAREA';
  const isSelect = element.tagName === 'SELECT';
  return isInput || isTextarea || isSelect || element.isContentEditable;
}

// Clicking a node leaves focus on the page body, so the diagram view is the body or the scrolling output box.
function isDiagramViewTarget(target: EventTarget | null) {
  return target === document.body || outputBox.contains(target as Node);
}

function buildSourceWithNodesRemoved(ids: string[]) {
  let source = codeBox.value;
  for (const id of ids) {
    const { graph, problems } = parseEditorGraph(source);
    if (problems.length)
      throw new Error(problems.join('; '));
    const node = graph.nodes.get(id);
    // An earlier removal in this same delete can already have taken this node away.
    if (!node)
      continue;
    if (node.kind === 'question') {
      const choices = graph.edges.filter((edge) => edge.from === id).map((edge) => edge.to);
      source = buildQuestionRemovedSource(graph, id, choices, 0);
    }
    else if (node.kind === 'choice')
      source = buildChoiceRemovedSource(graph, id);
    else
      source = buildBlockRemovedSource(graph, id);
  }
  return source;
}

function removeSelectedNodesOnDeleteKey(event: KeyboardEvent) {
  const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace';
  if (!isDeleteKey)
    return;
  if (!isDiagramViewTarget(event.target))
    return;
  const selectedIds = [...getSelectedNodeIds()];
  if (!selectedIds.length)
    return;
  event.preventDefault();
  // One refused node stops the whole delete.
  for (const id of selectedIds) {
    if (refuseEditInPathView('removeNode', id))
      return;
  }
  const newSource = buildSourceWithNodesRemoved(selectedIds);
  // Clear selection before committing so the saved metadata doesn't point at a removed node.
  selectEditorNode(null);
  executeEditorAction(() => applyEditorSource(newSource));
}
document.addEventListener('keydown', removeSelectedNodesOnDeleteKey);

function runUndoRedoOnCmdZ(event: KeyboardEvent) {
  if (!event.metaKey)
    return;
  if (event.key.toLowerCase() !== 'z')
    return;
  if (isTextBoxTarget(event.target))
    return;
  event.preventDefault();
  if (event.shiftKey)
    applyEditorRedo();
  else
    applyEditorUndo();
}
document.addEventListener('keydown', runUndoRedoOnCmdZ);

function saveOnCmdS(event: KeyboardEvent) {
  if (!event.metaKey)
    return;
  if (event.key.toLowerCase() !== 's')
    return;
  event.preventDefault();
  document.getElementById('saveBtn')!.click();
}
document.addEventListener('keydown', saveOnCmdS);

function focusSearchOnCmdF(event: KeyboardEvent) {
  if (!event.metaKey)
    return;
  if (event.key.toLowerCase() !== 'f')
    return;
  event.preventDefault();
  searchInput.focus();
  searchInput.select();
}
document.addEventListener('keydown', focusSearchOnCmdF);

function zoomOnCmdPlusMinus(event: KeyboardEvent) {
  if (!event.metaKey)
    return;
  const isZoomIn = event.key === '+' || event.key === '=';
  const isZoomOut = event.key === '-';
  if (isZoomIn) {
    event.preventDefault();
    zoomInBtn.click();
  }
  else if (isZoomOut) {
    event.preventDefault();
    zoomOutBtn.click();
  }
}
document.addEventListener('keydown', zoomOnCmdPlusMinus);

function selectNeighborNodeOnArrowKey(event: KeyboardEvent) {
  const isArrowUp = event.key === 'ArrowUp';
  const isArrowDown = event.key === 'ArrowDown';
  if (!isArrowUp && !isArrowDown)
    return;
  if (!isDiagramViewTarget(event.target))
    return;
  const selectedId = state.selectedEditorNodeId;
  if (!selectedId)
    return;
  if (refuseMoveWhileNodeNameIsInvalid())
    return;
  const { graph, problems } = parseEditorGraph(codeBox.value);
  if (problems.length)
    throw new Error(problems.join('; '));
  // const neighborEdge = isArrowDown
  //   ? graph.edges.find((edge) => edge.from === selectedId)
  //   : graph.edges.find((edge) => edge.to === selectedId);
  // A view leaves some blocks out; the arrow keys skip them.
  const isStepDown = (edge: { from: string; to: string }) => edge.from === selectedId && isNodeDrawn(edge.to);
  const isStepUp = (edge: { from: string; to: string }) => edge.to === selectedId && isNodeDrawn(edge.from);
  const neighborEdge = graph.edges.find(isArrowDown ? isStepDown : isStepUp);
  if (!neighborEdge)
    return;
  event.preventDefault();
  const neighborId = isArrowDown ? neighborEdge.to : neighborEdge.from;
  selectEditorNode(neighborId);
  moveNodeToViewportCenter(outputBox, diagramBox, neighborId);
  saveEditorViewState();
}
document.addEventListener('keydown', selectNeighborNodeOnArrowKey);

function moveToQuestionOnAngleBracket(event: KeyboardEvent) {
  const isNext = event.key === '>';
  const isPrevious = event.key === '<';
  if (!isNext && !isPrevious)
    return;
  if (isTextBoxTarget(event.target))
    return;
  event.preventDefault();
  if (isNext)
    nextDecisionBtn.click();
  else
    previousDecisionBtn.click();
}
document.addEventListener('keydown', moveToQuestionOnAngleBracket);
