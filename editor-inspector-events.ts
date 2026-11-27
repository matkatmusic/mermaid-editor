import { checkTypedNodeName, commitNodeName, isNodeNameBoxInvalid, refuseMoveWhileNodeNameIsInvalid } from './editor-rename.ts';
import { decisionShapeSwitch, destinationSelect, nodeAlignRow, nodeInspectorActions, nodeNameInput, nodeNotesInput, nodeTextInput, outputBox, walkBackBtn, walkBackCancelBtn, walkBackChoices, walkBackDialog } from './dom.ts';
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
import { applyDestination, applyDestinationSelection, updateDecisionShape, updateNodeNote, updateNodeText } from './editor-commit.ts';
import { addChoiceOnDecision, insertDecisionAfterNode, insertStaticAfterNode } from './editor-insert-after.ts';
import { updateNodeInspectorPosition } from './node-inspector-focus.ts';
import { getOneLineLabel } from './editor-parse.ts';
import { setNodeAlignment, setNodeJustification } from './editor-node-align.ts';
import { resetNodeSize } from './editor-node-size.ts';
import type { Alignment, Justification } from './node-align.ts';

// The bounding box of all text lines of the label; the size wrapper that fills a sized block is not text.
function isPointInsideLabelText(nodeEl: Element, x: number, y: number) {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  const walker = document.createTreeWalker(nodeEl.querySelector('.nodeLabel')!, NodeFilter.SHOW_TEXT);
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    const range = document.createRange();
    range.selectNodeContents(current);
    for (const rect of range.getClientRects()) {
      if (rect.width === 0)
        continue;
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
      top = Math.min(top, rect.top);
      bottom = Math.max(bottom, rect.bottom);
    }
  }
  return x >= left && x <= right && y >= top && y <= bottom;
}
// The first click of a double click selects the node, the inspector grows and the diagram moves up to about 12 px.
// So "on the text" is decided at the first press, where the user aimed, not at the double click.
let firstPress: { nodeId: string; isOnText: boolean } | null = null;
function rememberFirstPress(event: MouseEvent) {
  if (event.detail !== 1)
    return;
  const nodeEl = (event.target as HTMLElement).closest('g.node');
  if (!nodeEl)
    return;
  firstPress = { nodeId: getNodeId(nodeEl), isOnText: isPointInsideLabelText(nodeEl, event.clientX, event.clientY) };
}
outputBox.addEventListener('mousedown', rememberFirstPress, true);
// A double click on the text opens the Node text editor; a double click on the block outside the text gives the block its automatic size.
function openNodeTextEditor(event: MouseEvent) {
  const nodeEl = (event.target as HTMLElement).closest('g.node');
  if (!nodeEl)
    return;
  if (refuseMoveWhileNodeNameIsInvalid())
    return;
  const isOnText = firstPress?.nodeId === getNodeId(nodeEl) ? firstPress.isOnText : isPointInsideLabelText(nodeEl, event.clientX, event.clientY);
  firstPress = null;
  if (!isOnText) {
    resetNodeSize(getNodeId(nodeEl));
    return;
  }
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
  // else if (action === 'add-decision-after')
  //   applyDestination(NEW_DECISION_DESTINATION);
  else if (action === 'add-decision-after') {
    // applyDestination replaces the destination; a path view keeps the end point, so the decision goes into the arrow.
    if (state.pathView) {
      if (!state.selectedEditorNodeId)
        return;
      setEditorActionPromise(insertDecisionAfterNode(state.selectedEditorNodeId, getEditorGraph()));
    }
    else
      applyDestination(NEW_DECISION_DESTINATION);
  }
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
function walkBackFromSelectedNode() {
  const graph = getEditorGraph();
  const parentIds = [...new Set(graph.edges.filter((edge) => edge.to === state.selectedEditorNodeId).map((edge) => edge.from))];
  const hasOneParent = parentIds.length === 1;
  if (hasOneParent) {
    selectEditorNode(parentIds[0]);
    return;
  }
  const choiceButtons = parentIds.map((id) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'phone-choice';
    button.dataset.nodeId = id;
    button.textContent = getOneLineLabel(graph.nodes.get(id)!.label);
    return button;
  });
  walkBackChoices.replaceChildren(...choiceButtons);
  walkBackDialog.showModal();
}
walkBackBtn.addEventListener('click', walkBackFromSelectedNode);
function selectWalkBackChoice(event: MouseEvent) {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-node-id]');
  if (!button)
    return;
  walkBackDialog.close();
  selectEditorNode(button.dataset.nodeId!);
}
walkBackChoices.addEventListener('click', selectWalkBackChoice);
function closeWalkBackDialog() {
  walkBackDialog.close();
}
walkBackCancelBtn.addEventListener('click', closeWalkBackDialog);
function writeNodeTextOnCommitKey(event: KeyboardEvent) {
  const isEnter = event.key === 'Enter';
  const isTab = event.key === 'Tab';
  const isCommitKey = isEnter || isTab;
  if (!isCommitKey)
    return;
  const isShiftEnter = isEnter && event.shiftKey;
  if (isShiftEnter)
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
// The switch is on the diamond side when checked.
function changeDecisionShapeOnSwitch() {
  updateDecisionShape(state.selectedEditorNodeId, !decisionShapeSwitch.checked);
}
decisionShapeSwitch.addEventListener('change', changeDecisionShapeOnSwitch);
function setNodeAlignOnButtonClick(event: MouseEvent) {
  const button = (event.target as HTMLElement).closest('button');
  if (!button)
    return;
  const id = state.selectedEditorNodeId;
  if (!id)
    return;
  const { justification, alignment } = button.dataset;
  if (justification)
    setNodeJustification(id, justification as Justification);
  if (alignment)
    setNodeAlignment(id, alignment as Alignment);
}
nodeAlignRow.addEventListener('click', setNodeAlignOnButtonClick);
function renameNodeOnCommitKey(event: KeyboardEvent) {
  const isCommitKey = event.key === 'Enter' || event.key === 'Tab';
  if (!isCommitKey)
    return;
  event.preventDefault();
  commitNodeName();
}
nodeNameInput.addEventListener('keydown', renameNodeOnCommitKey);
// The coding standard for node names is capitals and underscores, so the box forces it while the user types.
function forceNodeNameFormat() {
  const { selectionStart, selectionEnd } = nodeNameInput;
  nodeNameInput.value = nodeNameInput.value.toUpperCase().replace(/ /g, '_');
  nodeNameInput.setSelectionRange(selectionStart, selectionEnd);
}
nodeNameInput.addEventListener('input', forceNodeNameFormat);
nodeNameInput.addEventListener('input', checkTypedNodeName);
// Click-away renames too; after a pointer press the rename waits for the click to land.
function renameNodeOnChange() {
  // A bad name stays in the box, so a click on another node can be refused and the user can fix the name.
  if (isNodeNameBoxInvalid())
    return;
  const id = state.selectedEditorNodeId;
  const text = nodeNameInput.value;
  if (!isPointerPressed) {
    commitNodeName(id, text);
    return;
  }
  function renameNodeLater() {
    commitNodeName(id, text);
  }
  function scheduleRenameAfterClick() {
    setTimeout(renameNodeLater);
  }
  document.addEventListener('pointerup', scheduleRenameAfterClick, { once: true });
}
nodeNameInput.addEventListener('change', renameNodeOnChange);
function writeNodeNoteOnChange() {
  const id = state.selectedEditorNodeId;
  const text = nodeNotesInput.value.trim();
  if (!isPointerPressed) {
    updateNodeNote(id, text);
    return;
  }
  function writeNodeNoteLater() {
    updateNodeNote(id, text);
  }
  function scheduleNoteCommitAfterClick() {
    setTimeout(writeNodeNoteLater);
  }
  document.addEventListener('pointerup', scheduleNoteCommitAfterClick, { once: true });
}
nodeNotesInput.addEventListener('change', writeNodeNoteOnChange);
function writeNodeNoteOnEnter(event: KeyboardEvent) {
  if (event.key !== 'Enter')
    return;
  if (event.shiftKey)
    return;
  event.preventDefault();
  updateNodeNote();
}
nodeNotesInput.addEventListener('keydown', writeNodeNoteOnEnter);
function clearSelectionOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape')
    return;
  selectEditorNode(null);
}
document.addEventListener('keydown', clearSelectionOnEscape);
outputBox.addEventListener('scroll', updateNodeInspectorPosition);
window.addEventListener('resize', updateNodeInspectorPosition);
