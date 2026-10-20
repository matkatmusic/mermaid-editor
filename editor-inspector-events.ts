import { destinationSelect, nodeInspectorActions, nodeTextInput, outputBox } from './dom.ts';
import { getNodeId } from './render-helpers.ts';
import { selectEditorNode } from './editor-actions.ts';
import { getEditorGraph } from './editor-graph.ts';
import { setEditorActionPromise } from './editor-metadata.ts';
import { NEW_DECISION_DESTINATION, NEW_STATIC_DESTINATION, state } from './state.ts';
import { addBlockAfter, addChoice, addQuestionAfter } from './editor-add.ts';
import { insertDecisionBefore, insertStaticBefore } from './editor-insert-before.ts';
import { removeBlock, removeChoice, removeChoices } from './editor-remove.ts';
import { applyQuestionRemoval, clearQuestionRemoval, moveRemovalPreview, removeQuestion } from './editor-remove-question.ts';
import { applyEditorRedo, applyEditorUndo } from './editor-history.ts';
import { applyDestination, applyDestinationSelection, updateNodeText } from './editor-commit.ts';
import { addChoiceOnDecision, insertDecisionAfterNode, insertStaticAfterNode } from './editor-insert-after.ts';
import { updateNodeInspectorPosition } from './node-inspector-focus.ts';

function openNodeTextEditor(event: MouseEvent) {
  const nodeEl = (event.target as HTMLElement).closest('g.node');
  if (!nodeEl)
    return;
  selectEditorNode(getNodeId(nodeEl));
  nodeTextInput.focus();
  nodeTextInput.select();
}
outputBox.addEventListener('dblclick', openNodeTextEditor);

document.getElementById('addQuestionAfterBtn')!.addEventListener('click', addQuestionAfter);
document.getElementById('addBlockAfterBtn')!.addEventListener('click', addBlockAfter);
document.getElementById('removeQuestionBtn')!.addEventListener('click', removeQuestion);
document.getElementById('removeBlockBtn')!.addEventListener('click', removeBlock);
document.getElementById('addChoiceBtn')!.addEventListener('click', addChoice);
document.getElementById('removeChoiceBtn')!.addEventListener('click', removeChoice);
document.getElementById('nextRemovalPathBtn')!.addEventListener('click', moveRemovalPreview);
document.getElementById('confirmRemoveQuestionBtn')!.addEventListener('click', applyQuestionRemoval);
document.getElementById('cancelRemoveQuestionBtn')!.addEventListener('click', clearQuestionRemoval);
document.getElementById('editorUndoBtn')!.addEventListener('click', applyEditorUndo);
document.getElementById('editorRedoBtn')!.addEventListener('click', applyEditorRedo);
function clearEditorSelection() {
  selectEditorNode(null);
}
document.getElementById('nodeInspectorDismissBtn')!.addEventListener('click', clearEditorSelection);
destinationSelect.addEventListener('change', applyDestinationSelection);
function dispatchInspectorAction(event: MouseEvent) {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  const action = button?.dataset.action;
  if (action === 'add-static-after')
    applyDestination(NEW_STATIC_DESTINATION);
  else if (action === 'insert-static-after') {
    if (!state.selectedEditorNodeId)
      return;
    setEditorActionPromise(insertStaticAfterNode(state.selectedEditorNodeId, getEditorGraph()));
  }
  else if (action === 'insert-decision-after') {
    if (!state.selectedEditorNodeId)
      return;
    setEditorActionPromise(insertDecisionAfterNode(state.selectedEditorNodeId, getEditorGraph()));
  }
  else if (action === 'add-decision-after')
    applyDestination(NEW_DECISION_DESTINATION);
  else if (action === 'add-choice')
    addChoiceOnDecision();
  else if (action === 'remove') {
    const kind = getEditorGraph().nodes.get(state.selectedEditorNodeId ?? '')?.kind;
    if (kind === 'question')
      removeQuestion();
    else if (kind === 'block')
      removeBlock();
    else if (kind === 'choice')
      removeChoice();
  }
  else if (action === 'remove-choices')
    removeChoices();
  else if (action === 'insert-static-before')
    insertStaticBefore();
  else if (action === 'insert-decision-before')
    insertDecisionBefore();
}
nodeInspectorActions.addEventListener('click', dispatchInspectorAction);
function writeNodeTextOnCommitKey(event: KeyboardEvent) {
  const isEnter = event.key === 'Enter';
  const isTab = event.key === 'Tab';
  const isCommitKey = isEnter || isTab;
  if (!isCommitKey)
    return;
  event.preventDefault();
  updateNodeText();
}
nodeTextInput.addEventListener('keydown', writeNodeTextOnCommitKey);
let isPointerPressed = false;
function markPointerPressed() {
  isPointerPressed = true;
}
function clearPointerPressed() {
  isPointerPressed = false;
}
document.addEventListener('pointerdown', markPointerPressed, true);
document.addEventListener('pointerup', clearPointerPressed, true);
// Click-away writes the text but skips the move-on step.
function writeNodeTextOnChange() {
  state.advanceAfterDecisionText = null;
  state.focusDestinationAfterTextId = null;
  const id = state.selectedEditorNodeId;
  const text = nodeTextInput.value.trim();
  if (!isPointerPressed) {
    updateNodeText(id, text);
    return;
  }
  function writeNodeTextLater() {
    updateNodeText(id, text);
  }
  function scheduleCommitAfterClick() {
    setTimeout(writeNodeTextLater);
  }
  // A re-render before mouseup swallows the click, so write after the click lands.
  document.addEventListener('pointerup', scheduleCommitAfterClick, { once: true });
}
nodeTextInput.addEventListener('change', writeNodeTextOnChange);
function clearSelectionOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape')
    return;
  selectEditorNode(null);
}
document.addEventListener('keydown', clearSelectionOnEscape);
outputBox.addEventListener('scroll', updateNodeInspectorPosition);
window.addEventListener('resize', updateNodeInspectorPosition);
