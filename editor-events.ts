import { classEditorCancelBtn, classEditorCreateBtn, classEditorDialog, classEditorError, classEditorFill, classEditorName, classEditorStroke, classPickerBtn, classPickerList, classesCloseBtn, classesDialog, classesError, classesList, classesMenuBtn, classesNewBtn, codeBox, destinationSelect, diagramBox, nodeInspectorActions, nodeTextInput, outputBox, phoneDiagramBox } from './dom.ts';
import { nodeIdOf } from './render-helpers.ts';
import { selectEditorNode } from './editor-actions.ts';
import { editorGraph, setEditorActionPromise } from './editor-graph.ts';
import { NEW_DECISION_DESTINATION, NEW_STATIC_DESTINATION, phonePath, state } from './state.ts';
import { render } from './render.ts';
import { nearestFeedingChoice } from './decision-nav.ts';
import { addBlockAfter, addChoice, addQuestionAfter, insertDecisionBefore, insertStaticBefore } from './editor-add.ts';
import { advanceRemovalPreview, cancelQuestionRemoval, confirmQuestionRemoval, redoEditorAction, removeBlock, removeChoice, removeChoices, removeQuestion, undoEditorAction } from './editor-remove.ts';
import { addChoiceOnDecision, applyDestination, commitDestination, commitInsertDecisionAfter, commitInsertStaticAfter, commitNodeText } from './editor-commit.ts';
import { assignClass, classDefByName, createClass, deleteClass, parseClassDefs, renameClass, setClassColors } from './class-defs.ts';
import { positionNodeInspector } from './node-inspector.ts';

outputBox.addEventListener('click', (event) => {
  const nodeEl = (event.target as HTMLElement).closest('g.node');
  const id = nodeEl ? nodeIdOf(nodeEl) : null;
  selectEditorNode(id);
  if (id) {
    const graph = editorGraph();
    const node = graph.nodes.get(id);
    if (node?.kind === 'question') {
      state.phoneFocusNodeId = id;
      state.phoneFocusUsesDecisionContext = true;
      state.phonePreviewChoiceId = null;
      render();
    }
    else {
      const feedingChoice = nearestFeedingChoice(id, graph);
      if (feedingChoice) {
        state.phoneFocusNodeId = null;
        state.phoneFocusUsesDecisionContext = false;
        state.phonePreviewChoiceId = feedingChoice;
        render();
      }
    }
  }
});

phoneDiagramBox.addEventListener('click', async (event) => {
  // A phone choice also selects and scrolls the main view to the next open decision.
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-choose], button[data-revert]');
  if (!target)
    return;
  if (target.dataset.choose) {
    phonePath.push(target.dataset.choose);
  }
  else {
    const [indexStr, choiceId] = target.dataset.revert!.split(':');
    phonePath.length = Number(indexStr);
    phonePath.push(choiceId);
  }
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  await render();
  if (state.currentBottomQ) {
    state.currentDecisionId = state.currentBottomQ;
    selectEditorNode(state.currentBottomQ);
    // centerNodeInViewport(outputBox, diagramBox, state.currentBottomQ);
    const node = diagramBox.querySelector('[id*="flowchart-' + state.currentBottomQ + '-"]')!;
    const outputRect = outputBox.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    outputBox.scrollBy({
      left: nodeRect.left + nodeRect.width / 2 - outputRect.left - outputBox.clientWidth / 2,
      top: nodeRect.top + nodeRect.height / 2 - outputRect.top - outputBox.clientHeight / 2,
      behavior: 'smooth',
    });
  }
});

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

// Class picker (node inspector "Class" row)
classPickerBtn.addEventListener('click', () => {
  classPickerList.hidden = !classPickerList.hidden;
});
document.addEventListener('click', (event) => {
  const insidePicker = (event.target as HTMLElement).closest('#classPicker');
  if (!insidePicker)
    classPickerList.hidden = true;
});
classPickerList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button.class-picker-row');
  if (!button)
    return;
  const nodeId = classPickerBtn.dataset.nodeId!;
  classPickerList.hidden = true;
  if (button.dataset.className)
    setEditorActionPromise(assignClass(nodeId, button.dataset.className));
  else if (button.dataset.classNone !== undefined)
    setEditorActionPromise(assignClass(nodeId, null));
  else if (button.dataset.classNew !== undefined)
    openClassEditor(nodeId);
});

// Class editor dialog (create a new class, optionally assigning it to a node)
let classEditorAssignNodeId: string | null = null;

function openClassEditor(assignToNodeId: string | null) {
  classEditorAssignNodeId = assignToNodeId;
  classEditorName.value = '';
  classEditorFill.value = '#ffffff';
  classEditorStroke.value = '#000000';
  classEditorError.textContent = '';
  classEditorDialog.showModal();
}

classEditorCancelBtn.addEventListener('click', () => classEditorDialog.close());
classEditorCreateBtn.addEventListener('click', () => {
  const name = classEditorName.value.trim();
  if (!name) {
    classEditorError.textContent = 'Name is required.';
    return;
  }
  if (classDefByName(codeBox.value, name)) {
    classEditorError.textContent = `Class "${name}" already exists.`;
    return;
  }
  classEditorError.textContent = '';
  const assignToNodeId = classEditorAssignNodeId;
  setEditorActionPromise((async () => {
    await createClass(name, classEditorFill.value, classEditorStroke.value);
    if (assignToNodeId)
      await assignClass(assignToNodeId, name);
    if (classesDialog.open)
      renderClassesDialog();
  })());
  classEditorDialog.close();
});

// File menu > Classes... dialog (list every class; edit, rename, or delete it)
function renderClassesDialog() {
  const defs = parseClassDefs(codeBox.value);
  classesList.innerHTML = defs.map(def => `
    <div class="classes-row" data-class-name="${def.name}">
      <input type="color" class="classes-fill" value="${def.fill}">
      <input type="color" class="classes-stroke" value="${def.stroke}">
      <input type="text" class="classes-name" value="${def.name}">
      <button type="button" class="classes-delete">Delete</button>
    </div>`).join('');
  classesError.textContent = '';
}

classesMenuBtn.addEventListener('click', () => {
  document.getElementById('fileMenu')!.removeAttribute('open');
  renderClassesDialog();
  classesDialog.showModal();
});
classesCloseBtn.addEventListener('click', () => classesDialog.close());
classesNewBtn.addEventListener('click', () => openClassEditor(null));
classesList.addEventListener('change', (event) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>('.classes-row');
  if (!row)
    return;
  const name = row.dataset.className!;
  const target = event.target as HTMLInputElement;
  if (target.classList.contains('classes-fill') || target.classList.contains('classes-stroke')) {
    const fill = row.querySelector<HTMLInputElement>('.classes-fill')!.value;
    const stroke = row.querySelector<HTMLInputElement>('.classes-stroke')!.value;
    setEditorActionPromise(setClassColors(name, fill, stroke).then(renderClassesDialog));
  }
  else if (target.classList.contains('classes-name')) {
    const newName = target.value.trim();
    if (!newName || newName === name) {
      target.value = name;
      return;
    }
    if (parseClassDefs(codeBox.value).some(def => def.name === newName)) {
      classesError.textContent = `Class "${newName}" already exists.`;
      target.value = name;
      return;
    }
    setEditorActionPromise(renameClass(name, newName).then(renderClassesDialog));
  }
});
classesList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.classes-delete');
  if (!button)
    return;
  const name = button.closest<HTMLElement>('.classes-row')!.dataset.className!;
  setEditorActionPromise(deleteClass(name).then(renderClassesDialog));
});
