import { INSPECTOR_TITLES } from './editor-types.ts';
import type { EditorGraph } from './editor-types.ts';
import { getEditorGraph } from './editor-graph.ts';
import { destinationRow, destinationSelect, nodeClassRow, nodeInspector, nodeInspectorActions, nodeInspectorControls, nodeInspectorDismissBtn, nodeInspectorRemovalPreview, nodeInspectorTitle, nodeTextInput } from './dom.ts';
import { NEW_DECISION_DESTINATION, NEW_STATIC_DESTINATION, state } from './state.ts';
import { findOutgoingDestination } from './source-edit.ts';
import { renderClassPicker } from './node-inspector-class.ts';
import { clearInspectorFocus, updateNodeInspectorPosition } from './node-inspector-focus.ts';

export function replaceDeclarationInLine(line: string, id: string, newToken: string) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escapedId}(\\{[^}]*\\}|\\[[^\\]]*\\]|\\(\\[[^\\]]*\\]\\))`);
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
    nodeTextInput.value = '';
    clearInspectorFocus();
    return;
  }
  const previewing = !!state.pendingRemoval;
  nodeInspectorTitle.textContent = INSPECTOR_TITLES[node.kind];
  nodeTextInput.value = node.label;
  // Retired Category/Color inputs; a class picker (any node kind) replaces them below.
  // nodeTypeRow.hidden = previewing || node.kind !== 'block';
  // nodeTypeColorRow.hidden = previewing;
  // nodeTypeInput.value = node.kind === 'block' ? nodeType : '';
  // nodeTypeColorInput.value = colorForNode(node);
  nodeClassRow.hidden = previewing;
  if (!previewing)
    renderClassPicker(node);
  nodeInspectorRemovalPreview.hidden = !previewing;
  nodeInspectorActions.hidden = previewing;
  nodeInspectorControls.hidden = previewing;
  if (previewing) {
    updateNodeInspectorPosition();
    return;
  }
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
  nodeInspectorActions.replaceChildren(...actions);
  const hasDestination = node.kind !== 'question';
  destinationRow.hidden = !hasDestination;
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
      destinationSelect.add(new Option(`${candidate.label} (${candidate.id})`, candidate.id));
    }
    destinationSelect.value = destination ?? '';
    nodeInspectorDismissBtn.textContent = destination ? 'Cancel' : 'Close';
  }
  else {
    nodeInspectorDismissBtn.textContent = 'Cancel';
  }
  updateNodeInspectorPosition();
}

