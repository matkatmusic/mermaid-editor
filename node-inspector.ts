import { INSPECTOR_TITLES } from './editor-types.ts';
import type { EditorGraph } from './editor-types.ts';
import { getEditorGraph } from './editor-graph.ts';
import { getNodeNamePart, getParentQuestionId, showNameCheck } from './editor-rename.ts';
import { decisionShapeRow, decisionShapeSwitch, nodeKindChoiceBox, nodeKindQuestionBox, nodeKindStaticBox, nodeNameInput, nodeParentLabel, destinationRow, destinationSelect, nodeAlignRow, nodeClassRow, nodeInspector, nodeInspectorActions, nodeInspectorControls, nodeInspectorDismissBtn, nodeInspectorRemovalPreview, nodeInspectorTitle, nodeNotesInput, nodeNotesRow, nodeTextInput, walkBackBtn } from './dom.ts';
import { NEW_DECISION_DESTINATION, NEW_STATIC_DESTINATION, state } from './state.ts';
import { findOutgoingDestination } from './source-edit.ts';
import { decodeLabelLineBreaks, decodeLabelQuotes, getOneLineLabel } from './editor-parse.ts';
import { renderClassPicker } from './node-inspector-class.ts';
import { getNodeAlign } from './node-align.ts';
import { clearInspectorFocus, updateNodeInspectorPosition } from './node-inspector-focus.ts';
import { applyInspectorExtraHeight } from './inspector-resize.ts';
import { showDestinationInInput } from './destination-picker.ts';
import { disableRefusedButtons } from './path-view.ts';

export function replaceDeclarationInLine(line: string, id: string, newToken: string) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // A quoted label may hold "]" or "}", so a quoted shape is tried before the plain one.
  const re = new RegExp(`${escapedId}(\\{\\{"[^"]*"\\}\\}|\\{"[^"]*"\\}|\\["[^"]*"\\]|\\{\\{[^}]*\\}\\}|\\{[^}]*\\}|\\[[^\\]]*\\]|\\(\\[[^\\]]*\\]\\))`);
  return line.replace(re, newToken);
}

// function beginInlineEdit(nodeEl: Element, id: string, kind: EditorNodeKind) {
//   const label = nodeEl.querySelector('.nodeLabel') as HTMLElement | null;
//   if (!label)
//     return;
//   label.contentEditable = 'true';
//   label.focus();
//   let committed = false;
//   const commit = () => {
//     if (committed)
//       return;
//     committed = true;
//     label.contentEditable = 'false';
//     const text = (label.textContent ?? '').trim();
//     const graph = editorGraph();
//     const node = graph.nodes.get(id);
//     if (!node)
//       return;
//     const newToken = kind === 'question' ? `${id}{"${text}"}` : `${id}["${text}"]`;
//     const lines = graph.lines.slice();
//     lines[node.lineIndex] = replaceDeclarationInLine(lines[node.lineIndex], id, newToken);
//     executeEditorAction(() => applyEditorSource(lines.join('\n')));
//   };
//   label.addEventListener('keydown', (event) => {
//     if ((event as KeyboardEvent).key !== 'Enter')
//       return;
//     event.preventDefault();
//     commit();
//   });
//   label.addEventListener('blur', commit, { once: true });
// }

export function createInspectorActionButton(action: string, label: string, spanTwoColumns = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.textContent = label;
  button.classList.toggle('span-2', spanTwoColumns);
  return button;
}

export function renderNodeInspector() {
  let graph: EditorGraph;
  try {
    graph = getEditorGraph();
  }
  catch {
    nodeInspector.hidden = true;
    clearInspectorFocus();
    return;
  }
  const node = graph.nodes.get(state.selectedEditorNodeId ?? '');
  nodeInspector.hidden = !node;
  if (!node) {
    decisionShapeRow.hidden = true;
    nodeAlignRow.hidden = true;
    nodeTextInput.value = '';
    nodeNotesInput.value = '';
    clearInspectorFocus();
    return;
  }
  const previewing = !!state.pendingRemoval;
  nodeInspectorTitle.textContent = INSPECTOR_TITLES[node.kind];
  nodeTextInput.value = decodeLabelLineBreaks(decodeLabelQuotes(node.label));
  nodeKindStaticBox.checked = node.kind === 'block';
  nodeKindQuestionBox.checked = node.kind === 'question';
  nodeKindChoiceBox.checked = node.kind === 'choice';
  decisionShapeRow.hidden = node.kind !== 'question';
  decisionShapeSwitch.checked = !node.isHexagon;
  const parentId = getParentQuestionId(graph, node.id);
  const parentText = parentId === undefined ? 'parent: none' : `- parent: ${parentId}`;
  nodeParentLabel.textContent = node.kind === 'choice' ? parentText : '';
  nodeNameInput.value = getNodeNamePart(graph, node);
  showNameCheck({ fullId: node.id });
  nodeNotesInput.value = decodeLabelLineBreaks(node.note);
  const nodeAlign = getNodeAlign(graph.lines, node.id);
  nodeTextInput.style.textAlign = nodeAlign.justification;
  for (const button of nodeAlignRow.querySelectorAll('button')) {
    const isJustificationPressed = button.dataset.justification === nodeAlign.justification;
    const isAlignmentPressed = button.dataset.alignment === nodeAlign.alignment;
    button.setAttribute('aria-pressed', String(isJustificationPressed || isAlignmentPressed));
  }
  // Retired Category/Color inputs; a class picker (any node kind) replaces them below.
  // nodeTypeRow.hidden = previewing || node.kind !== 'block';
  // nodeTypeColorRow.hidden = previewing;
  // nodeTypeInput.value = node.kind === 'block' ? nodeType : '';
  // nodeTypeColorInput.value = colorForNode(node);
  nodeClassRow.hidden = previewing;
  nodeAlignRow.hidden = previewing;
  nodeNotesRow.hidden = previewing;
  if (!previewing)
    renderClassPicker(node);
  nodeInspectorRemovalPreview.hidden = !previewing;
  nodeInspectorActions.hidden = previewing;
  walkBackBtn.hidden = previewing;
  nodeInspectorControls.hidden = previewing;
  if (previewing) {
    applyInspectorExtraHeight();
    updateNodeInspectorPosition();
    return;
  }
  const hasParent = graph.edges.some((edge) => edge.to === node.id);
  walkBackBtn.disabled = !hasParent;
  const actions: HTMLButtonElement[] = [createInspectorActionButton('remove', 'Remove')];
  if (node.kind === 'question')
    actions.push(
      createInspectorActionButton('add-choice', 'Add choice'),
      createInspectorActionButton('remove-choices', 'Remove choices'),
      createInspectorActionButton('insert-static-before', 'insert static block before'),
      createInspectorActionButton('insert-decision-before', 'insert Decision & leading choice before'),
    );
  else if (node.kind === 'block')
    actions.push(
      createInspectorActionButton('add-decision-after', 'add Decision block after'),
      createInspectorActionButton('insert-decision-after', 'Insert decision block after'),
      createInspectorActionButton('insert-static-after', 'Insert static block after'),
      createInspectorActionButton('insert-static-before', 'insert static block before'),
      createInspectorActionButton('insert-decision-before', 'insert Decision & leading choice before'),
    );
  else if (node.kind === 'choice')
    actions.push(
      createInspectorActionButton('add-decision-after', 'add Decision block after'),
      createInspectorActionButton('add-static-after', 'add static block after'),
      createInspectorActionButton('insert-decision-after', 'Insert decision block after'),
      createInspectorActionButton('insert-static-after', 'Insert static block after'),
    );
  disableRefusedButtons(actions, graph, node.id);
  nodeInspectorActions.replaceChildren(...actions);
  const hasDestination = node.kind !== 'question';
  destinationRow.hidden = !hasDestination;
  // A path view does not allow a new destination.
  if (state.pathView)
    destinationRow.hidden = true;
  destinationSelect.replaceChildren();
  if (hasDestination) {
    destinationSelect.add(new Option('Terminal', ''));
    destinationSelect.add(new Option('New static block', NEW_STATIC_DESTINATION));
    destinationSelect.add(new Option('New Decision block', NEW_DECISION_DESTINATION));
    const destination = findOutgoingDestination(node.id, graph);
    const candidates = Array.from(graph.nodes.values());
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const isSelf = candidate.id === node.id;
      const isHiddenChoice = candidate.kind === 'choice' && candidate.id !== destination;
      if (isSelf)
        continue;
      if (isHiddenChoice)
        continue;
      destinationSelect.add(new Option(`${getOneLineLabel(candidate.label)} (${candidate.id})`, candidate.id));
    }
    destinationSelect.value = destination ?? '';
    nodeInspectorDismissBtn.textContent = destination ? 'Cancel' : 'Close';
  }
  else {
    nodeInspectorDismissBtn.textContent = 'Cancel';
  }
  showDestinationInInput();
  applyInspectorExtraHeight();
  updateNodeInspectorPosition();
}

