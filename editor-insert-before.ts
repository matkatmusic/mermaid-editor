import { state } from './state.ts';
import { getEditorGraph } from './editor-graph.ts';
import { getDeclarationSuffix } from './editor-parse.ts';
import { setEditorActionPromise } from './editor-metadata.ts';
import { appendInlineDecl, buildChoiceId, buildSourceWithLinesReplaced, getNextEditorId } from './source-edit.ts';
import { applyEditorSource } from './editor-actions.ts';
import { appendInlineDeclaration } from './editor-insert-after.ts';
import type { EditorEdge } from './editor-types.ts';

export function insertStaticBefore() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const selected = state.selectedEditorNodeId;
  const selectedNode = graph.nodes.get(selected)!;
  const removedLineIndexes = new Set<number>();
  const predecessors: EditorEdge[] = [];
  for (const edge of graph.edges) {
    if (edge.to !== selected)
      continue;
    predecessors.push(edge);
    removedLineIndexes.add(edge.lineIndex);
  }
  const staticId = getNextEditorId('B_NEW', graph);
  const newLines: string[] = [`  ${staticId}["New static block"]`];
  const restoredIds = new Set<string>();
  const isSelectedOnRemovedLine = removedLineIndexes.has(selectedNode.lineIndex);
  if (isSelectedOnRemovedLine)
    newLines.push(`  ${selected}${getDeclarationSuffix(selectedNode)}`);
  restoredIds.add(selected);
  for (const edge of predecessors)
    appendInlineDeclaration(newLines, restoredIds, graph, edge, edge.from);
  for (const edge of predecessors)
    newLines.push(edge.label ? `  ${edge.from} -- "${edge.label}" --> ${staticId}` : `  ${edge.from} --> ${staticId}`);
  newLines.push(`  ${staticId} --> ${selected}`);
  // Removing one segment drops the whole chained line, so recreate its other segments and their inline declarations.
  for (const edge of graph.edges) {
    const isOnRemovedLine = removedLineIndexes.has(edge.lineIndex);
    const isIntoSelected = edge.to === selected;
    const shouldKeep = isOnRemovedLine && !isIntoSelected;
    if (!shouldKeep)
      continue;
    appendInlineDeclaration(newLines, restoredIds, graph, edge, edge.from);
    appendInlineDeclaration(newLines, restoredIds, graph, edge, edge.to);
    newLines.push(edge.label ? `  ${edge.from} -- "${edge.label}" --> ${edge.to}` : `  ${edge.from} --> ${edge.to}`);
  }
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}

export function insertDecisionBefore() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const selected = state.selectedEditorNodeId;
  const selectedNode = graph.nodes.get(selected)!;
  const removedLineIndexes = new Set<number>();
  const predecessors: EditorEdge[] = [];
  for (const edge of graph.edges) {
    if (edge.to !== selected)
      continue;
    predecessors.push(edge);
    removedLineIndexes.add(edge.lineIndex);
  }
  const decisionId = getNextEditorId('Q_NEW', graph);
  const newChoiceId = buildChoiceId(decisionId, 'NEW');
  const newLines: string[] = [
    `  ${decisionId}{"New Decision"}`,
    `  ${newChoiceId}["New choice"]`,
    `  ${decisionId} --> ${newChoiceId}`,
  ];
  const isSelectedOnRemovedLine = removedLineIndexes.has(selectedNode.lineIndex);
  if (isSelectedOnRemovedLine)
    newLines.push(`  ${selected}${getDeclarationSuffix(selectedNode)}`);
  for (const edge of predecessors)
    appendInlineDecl(edge, edge.from, graph, newLines);
  for (const edge of predecessors)
    newLines.push(edge.label ? `  ${edge.from} -- "${edge.label}" --> ${decisionId}` : `  ${edge.from} --> ${decisionId}`);
  newLines.push(`  ${newChoiceId} --> ${selected}`);
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
