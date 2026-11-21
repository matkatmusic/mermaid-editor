import { findOutgoingDestination, removeOutgoing, replaceOutgoing } from './source-edit.ts';
import { applyEditorSource, appendEditorAction, selectEditorNode } from './editor-actions.ts';
import { NEW_DECISION_DESTINATION, NEW_STATIC_DESTINATION, state } from './state.ts';
import { replaceDeclarationInLine } from './node-inspector.ts';
import { decodeLabelLineBreaks, encodeLabelLineBreaks, encodeLabelQuotes } from './editor-parse.ts';
import { setInspectorDestinationFocus } from './node-inspector-focus.ts';
import { getEditorGraph } from './editor-graph.ts';
import { moveNodeToViewportCenter } from './decision-nav.ts';
import { createDecisionAfter, createStaticAfter } from './editor-insert-after.ts';
import { destinationSelect, diagramBox, nodeNotesInput, nodeTextInput, outputBox } from './dom.ts';
import { NOTE_PREFIX } from './editor-types.ts';

export function updateNodeNote(id = state.selectedEditorNodeId, text = nodeNotesInput.value.trim()) {
  if (!id)
    return;
  async function applyNodeNoteUpdate() {
    const graph = getEditorGraph();
    const node = graph.nodes.get(id!);
    if (!node || decodeLabelLineBreaks(node.note) === text)
      return;
    const oldCount = node.note ? node.note.split('\n').length : 0;
    const lines = graph.lines.slice();
    const indent = lines[node.lineIndex].match(/^\s*/)![0];
    const newNoteLines = text ? [`${indent}${NOTE_PREFIX} ${encodeLabelLineBreaks(text)}`] : [];
    lines.splice(node.lineIndex - oldCount, oldCount, ...newNoteLines);
    await applyEditorSource(lines.join('\n'));
  }
  appendEditorAction(applyNodeNoteUpdate);
}

export function updateNodeText(id = state.selectedEditorNodeId, text = nodeTextInput.value.trim()) {
  if (!id)
    return;
  const advance = state.advanceAfterDecisionText?.decisionId === id ? state.advanceAfterDecisionText : null;
  const focusDestination = state.focusDestinationAfterTextId === id;
  if (advance)
    state.advanceAfterDecisionText = null;
  if (focusDestination)
    state.focusDestinationAfterTextId = null;
  async function applyNodeTextUpdate() {
    const graph = getEditorGraph();
    const node = graph.nodes.get(id!);
    if (!node)
      return;
    const sourceText = encodeLabelLineBreaks(encodeLabelQuotes(text));
    if (node.label !== sourceText) {
      const newToken = node.kind === 'question' ? `${id}{"${sourceText}"}` : `${id}["${sourceText}"]`;
      const lines = graph.lines.slice();
      lines[node.lineIndex] = replaceDeclarationInLine(lines[node.lineIndex], id!, newToken);
      await applyEditorSource(lines.join('\n'));
    }
    if (advance) {
      selectEditorNode(advance.choiceId);
      setInspectorDestinationFocus();
    }
    else if (focusDestination) {
      selectEditorNode(id!);
      setInspectorDestinationFocus();
    }
  }
  appendEditorAction(applyNodeTextUpdate);
}

export function applyDestination(destination: string) {
  const id = state.selectedEditorNodeId;
  if (!id)
    return;
  const graph = getEditorGraph();
  const node = graph.nodes.get(id);
  const isMissing = !node;
  const isQuestion = node?.kind === 'question';
  const isUnsupported = isMissing || isQuestion;
  if (isUnsupported)
    return;
  const createsStatic = destination === NEW_STATIC_DESTINATION;
  const createsDecision = destination === NEW_DECISION_DESTINATION;
  const createsNothing = !createsStatic && !createsDecision;
  const isSameDestination = findOutgoingDestination(id, graph) === (destination || undefined);
  const isUnchanged = createsNothing && isSameDestination;
  if (isUnchanged)
    return;
  const text = nodeTextInput.value.trim();
  if (encodeLabelLineBreaks(encodeLabelQuotes(text)) !== node!.label)
    updateNodeText(id, text);
  async function applyDestinationChange() {
    const currentGraph = getEditorGraph();
    if (createsStatic)
      await createStaticAfter(id!, currentGraph);
    else if (createsDecision)
      await createDecisionAfter(id!, currentGraph);
    else {
      const source = destination
        ? replaceOutgoing(id!, destination, currentGraph)
        : removeOutgoing(id!, currentGraph);
      await applyEditorSource(source);
    }
    const centeredId = createsDecision ? state.selectedEditorNodeId! : id!;
    moveNodeToViewportCenter(outputBox, diagramBox, centeredId);
  }
  appendEditorAction(applyDestinationChange);
}

export function applyDestinationSelection() {
  applyDestination(destinationSelect.value);
}
