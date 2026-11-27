import { findOutgoingDestination, removeOutgoing, replaceOutgoing } from './source/model/source-edit.ts';
import { applyEditorSource, appendEditorAction, selectEditorNode } from './editor-actions.ts';
import { NEW_DECISION_DESTINATION, NEW_STATIC_DESTINATION, state } from './state.ts';
import { replaceDeclarationInLine } from './node-inspector.ts';
import { decodeLabelLineBreaks, encodeLabelLineBreaks, encodeLabelQuotes } from './source/model/editor-parse.ts';
import { setInspectorDestinationFocus } from './node-inspector-focus.ts';
import { getEditorGraph } from './source/model/editor-graph.ts';
import { moveNodeToViewportCenter } from './decision-nav.ts';
import { createDecisionAfter, createStaticAfter } from './editor-insert-after.ts';
import { destinationSelect, diagramBox, nodeNotesInput, nodeTextInput, outputBox } from './dom.ts';
import { buildSourceWithNodeProps } from './source/model/node-props.ts';
import { buildSourceWithoutNodeSize } from './source/model/node-size.ts';
import { refuseEditInPathView } from './path-view.ts';

// Rewrites only this decision's declaration between Q_X{{"text"}} (hexagon) and Q_X{"text"} (diamond); the text, class lines and edges stay.
export function updateDecisionShape(id: string | null, isHexagon: boolean) {
  if (!id)
    return;
  async function applyDecisionShapeUpdate() {
    const graph = getEditorGraph();
    const node = graph.nodes.get(id!);
    if (!node)
      return;
    const newToken = isHexagon ? `${id}{{"${node.label}"}}` : `${id}{"${node.label}"}`;
    const lines = graph.lines.slice();
    lines[node.lineIndex] = replaceDeclarationInLine(lines[node.lineIndex], id!, newToken);
    const newSource = lines.join('\n');
    // A diamond has no size, so its size line goes in the same edit.
    await applyEditorSource(isHexagon ? newSource : buildSourceWithoutNodeSize(newSource, id!));
  }
  appendEditorAction(applyDecisionShapeUpdate);
}

export function updateNodeNote(id = state.selectedEditorNodeId, text = nodeNotesInput.value.trim()) {
  if (!id)
    return;
  async function applyNodeNoteUpdate() {
    const graph = getEditorGraph();
    const node = graph.nodes.get(id!);
    if (!node || decodeLabelLineBreaks(node.note) === text)
      return;
    // const oldCount = node.note ? node.note.split('\n').length : 0;
    // const lines = graph.lines.slice();
    // const indent = lines[node.lineIndex].match(/^\s*/)![0];
    // const newNoteLines = text ? [`${indent}${NOTE_PREFIX} ${encodeLabelLineBreaks(text, node.note)}`] : [];
    // lines.splice(node.lineIndex - oldCount, oldCount, ...newNoteLines);
    // const indent = graph.lines[node.lineIndex].match(/^\s*/)![0];
    // const lines: string[] = [];
    // for (let lineIndex = 0; lineIndex < graph.lines.length; lineIndex++) {
    //   const isDeclarationLine = lineIndex === node.lineIndex;
    //   if (isDeclarationLine && text)
    //     lines.push(`${indent}${buildNoteLine(node.id, encodeLabelLineBreaks(text, node.note))}`);
    //   const isOldNoteOfNode = parseNoteLine(graph.lines[lineIndex])?.id === node.id;
    //   if (!isOldNoteOfNode)
    //     lines.push(graph.lines[lineIndex]);
    // }
    const note = text ? encodeLabelLineBreaks(text, node.note) : undefined;
    await applyEditorSource(buildSourceWithNodeProps(graph.lines.join('\n'), node.id, { note }));
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
    const sourceText = encodeLabelLineBreaks(encodeLabelQuotes(text), node.label);
    if (node.label !== sourceText) {
      const decisionToken = node.isHexagon ? `${id}{{"${sourceText}"}}` : `${id}{"${sourceText}"}`;
      const newToken = node.kind === 'question' ? decisionToken : `${id}["${sourceText}"]`;
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
  if (encodeLabelLineBreaks(encodeLabelQuotes(text), node!.label) !== node!.label)
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
  if (refuseEditInPathView('changeDestination', null))
    return;
  applyDestination(destinationSelect.value);
}
