import type { EditorEdge, EditorGraph } from './editor-types.ts';
import { buildChoiceId, buildSourceWithLinesReplaced, findOutgoingDestination, getNextEditorId, replaceOutgoing } from './source-edit.ts';
import { applyEditorSource, selectEditorNode } from './editor-actions.ts';
import { state } from './state.ts';
import { setInspectorTextFocus } from './node-inspector-focus.ts';
import { getEditorGraph } from './editor-graph.ts';
import { getDeclarationSuffix } from './editor-parse.ts';
import { setEditorActionPromise } from './editor-metadata.ts';

export async function createStaticAfter(sourceId: string, graph: EditorGraph) {
  const staticId = getNextEditorId('B_NEW', graph);
  const source = `${replaceOutgoing(sourceId, staticId, graph)}\n  ${staticId}["New static block"]`;
  await applyEditorSource(source);
  state.focusDestinationAfterTextId = staticId;
  selectEditorNode(staticId);
  setInspectorTextFocus();
}

export async function insertStaticAfterNode(sourceId: string, graph: EditorGraph) {
  const staticId = getNextEditorId('B_NEW', graph);
  const oldDestination = findOutgoingDestination(sourceId, graph);
  const newLines = [`  ${staticId}["New static block"]`];
  if (oldDestination)
    newLines.push(`  ${staticId} --> ${oldDestination}`);
  const source = `${replaceOutgoing(sourceId, staticId, graph)}\n${newLines.join('\n')}`;
  await applyEditorSource(source);
  state.focusDestinationAfterTextId = staticId;
  selectEditorNode(staticId);
  setInspectorTextFocus();
}

export function appendInlineDeclaration(newLines: string[], restoredIds: Set<string>, graph: EditorGraph, edge: EditorEdge, endpointId: string) {
  const node = graph.nodes.get(endpointId);
  const isOnEdgeLine = node?.lineIndex === edge.lineIndex;
  const isNotRestored = !restoredIds.has(endpointId);
  const shouldRestore = isOnEdgeLine && isNotRestored;
  if (shouldRestore) {
    restoredIds.add(endpointId);
    newLines.push(`  ${endpointId}${getDeclarationSuffix(node!)}`);
  }
}

export async function insertDecisionAfterNode(sourceId: string, graph: EditorGraph) {
  const removedLineIndexes = new Set<number>();
  const successors: EditorEdge[] = [];
  for (const edge of graph.edges) {
    if (edge.from !== sourceId)
      continue;
    successors.push(edge);
    removedLineIndexes.add(edge.lineIndex);
  }
  const decisionId = getNextEditorId('Q_NEW', graph);
  const yesId = buildChoiceId(decisionId, 'Y');
  const noId = buildChoiceId(decisionId, 'N');
  const newLines = [
    `  ${decisionId}{"New Decision"}`,
    `  ${yesId}["Yes"]`,
    `  ${noId}["No"]`,
    `  ${sourceId} --> ${decisionId}`,
    `  ${decisionId} --> ${yesId}`,
    `  ${decisionId} --> ${noId}`,
  ];
  const restoredIds = new Set<string>();
  for (const edge of successors) {
    appendInlineDeclaration(newLines, restoredIds, graph, edge, edge.to);
    newLines.push(`  ${yesId} --> ${edge.to}`);
  }
  // Replacing one edge segment removes the whole line; restore every other segment so only sourceId's tail changes.
  for (const edge of graph.edges) {
    const isOnRemovedLine = removedLineIndexes.has(edge.lineIndex);
    const isFromSource = edge.from === sourceId;
    const shouldKeep = isOnRemovedLine && !isFromSource;
    if (!shouldKeep)
      continue;
    appendInlineDeclaration(newLines, restoredIds, graph, edge, edge.from);
    appendInlineDeclaration(newLines, restoredIds, graph, edge, edge.to);
    newLines.push(edge.label ? `  ${edge.from} -- "${edge.label}" --> ${edge.to}` : `  ${edge.from} --> ${edge.to}`);
  }
  await applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines));
  selectEditorNode(decisionId);
  setInspectorTextFocus();
}

export async function createDecisionAfter(sourceId: string, graph: EditorGraph) {
  await insertDecisionAfterNode(sourceId, graph);
}

async function appendChoiceToDecision(questionId: string, graph: EditorGraph) {
  const removedLineIndexes = new Set<number>();
  let suffix = 'NEW';
  let n = 1;
  while (graph.nodes.has(buildChoiceId(questionId, suffix)))
    suffix = 'NEW' + (++n);
  const cid = buildChoiceId(questionId, suffix);
  const newLines = [`  ${cid}["New choice"]`, `  ${questionId} --> ${cid}`];
  await applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines));
  selectEditorNode(questionId);
}

export function addChoiceOnDecision() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const questionId = state.selectedEditorNodeId;
  setEditorActionPromise(appendChoiceToDecision(questionId, graph));
}
