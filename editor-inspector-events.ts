import { destinationSelect, nodeInspectorActions, nodeTextInput, outputBox } from './dom.ts';
import { nodeIdOf } from './render-helpers.ts';
import { selectEditorNode } from './editor-actions.ts';
import { editorGraph, setEditorActionPromise } from './editor-graph.ts';
import { NEW_DECISION_DESTINATION, NEW_STATIC_DESTINATION, state } from './state.ts';
import { addBlockAfter, addChoice, addQuestionAfter, insertDecisionBefore, insertStaticBefore } from './editor-add.ts';
import { advanceRemovalPreview, cancelQuestionRemoval, confirmQuestionRemoval, redoEditorAction, removeBlock, removeChoice, removeChoices, removeQuestion, undoEditorAction } from './editor-remove.ts';
import { addChoiceOnDecision, applyDestination, commitDestination, commitInsertDecisionAfter, commitInsertStaticAfter, commitNodeText } from './editor-commit.ts';
import { positionNodeInspector } from './node-inspector.ts';

outputBox.addEventListener('dblclick', (event) => {
  const nodeEl = (event.target as HTMLElement).closest('g.node');
  if (!nodeEl)
    return;
  selectEditorNode(nodeIdOf(nodeEl));
  nodeTextInput.focus();
  nodeTextInput.select();
});

document.getElementById('addQuestionAfterBtn')!.addEventListener('click', addQuestionAfter);
document.getElementById('addBlockAfterBtn')!.addEventListener('click', addBlockAfter);
document.getElementById('removeQuestionBtn')!.addEventListener('click', removeQuestion);
document.getElementById('removeBlockBtn')!.addEventListener('click', removeBlock);
document.getElementById('addChoiceBtn')!.addEventListener('click', addChoice);
document.getElementById('removeChoiceBtn')!.addEventListener('click', removeChoice);
document.getElementById('nextRemovalPathBtn')!.addEventListener('click', advanceRemovalPreview);
document.getElementById('confirmRemoveQuestionBtn')!.addEventListener('click', confirmQuestionRemoval);
document.getElementById('cancelRemoveQuestionBtn')!.addEventListener('click', cancelQuestionRemoval);
document.getElementById('editorUndoBtn')!.addEventListener('click', undoEditorAction);
document.getElementById('editorRedoBtn')!.addEventListener('click', redoEditorAction);
document.getElementById('nodeInspectorDismissBtn')!.addEventListener('click', () => selectEditorNode(null));
destinationSelect.addEventListener('change', commitDestination);
nodeInspectorActions.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  const action = button?.dataset.action;
  if (action === 'add-static-after')
    applyDestination(NEW_STATIC_DESTINATION);
  else if (action === 'insert-static-after') {
    if (!state.selectedEditorNodeId)
      return;
    setEditorActionPromise(commitInsertStaticAfter(state.selectedEditorNodeId, editorGraph()));
  }
  else if (action === 'insert-decision-after') {
    if (!state.selectedEditorNodeId)
      return;
    setEditorActionPromise(commitInsertDecisionAfter(state.selectedEditorNodeId, editorGraph()));
  }
  else if (action === 'add-decision-after')
    applyDestination(NEW_DECISION_DESTINATION);
  else if (action === 'add-choice')
    addChoiceOnDecision();
  else if (action === 'remove') {
    const kind = editorGraph().nodes.get(state.selectedEditorNodeId ?? '')?.kind;
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
});
nodeTextInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter')
    return;
  event.preventDefault();
  commitNodeText();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape')
    return;
  selectEditorNode(null);
});
outputBox.addEventListener('scroll', positionNodeInspector);
window.addEventListener('resize', positionNodeInspector);
