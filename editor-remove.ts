import { state } from './state.ts';
import { getEditorGraph } from './editor-graph.ts';
import { setEditorActionPromise } from './editor-metadata.ts';
import { appendInlineDecl, buildSourceWithLinesReplaced } from './source-edit.ts';
import { applyEditorSource, selectEditorNode } from './editor-actions.ts';

export function removeChoice() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const id = state.selectedEditorNodeId;
  const node = graph.nodes.get(id);
  const removedLineIndexes = new Set<number>();
  const newLines: string[] = [];
  if (node)
    removedLineIndexes.add(node.lineIndex);
  for (const edge of graph.edges) {
    const touchesRemoved = edge.from === id || edge.to === id;
    if (!touchesRemoved)
      continue;
    removedLineIndexes.add(edge.lineIndex);
    const otherEndpoint = edge.from === id ? edge.to : edge.from;
    if (otherEndpoint !== id)
      appendInlineDecl(edge, otherEndpoint, graph, newLines);
  }
  // Clear selection before committing so the saved metadata doesn't point at the node this removes.
  selectEditorNode(null);
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}

export function removeBlock() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const id = state.selectedEditorNodeId;
  const node = graph.nodes.get(id);
  const removedLineIndexes = new Set<number>();
  const newLines: string[] = [];
  const predecessors: string[] = [];
  const successors: string[] = [];
  if (node)
    removedLineIndexes.add(node.lineIndex);
  for (const edge of graph.edges) {
    const touchesRemoved = edge.from === id || edge.to === id;
    if (!touchesRemoved)
      continue;
    removedLineIndexes.add(edge.lineIndex);
    if (edge.from === id) {
      successors.push(edge.to);
      appendInlineDecl(edge, edge.to, graph, newLines);
    }
    else {
      predecessors.push(edge.from);
      appendInlineDecl(edge, edge.from, graph, newLines);
    }
  }
  for (const predecessor of predecessors)
    for (const successor of successors)
      newLines.push(`  ${predecessor} --> ${successor}`);
  // Clear selection before committing so the saved metadata doesn't point at the node this removes.
  selectEditorNode(null);
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}

export function removeChoices() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const questionId = state.selectedEditorNodeId;
  const removedLineIndexes = new Set<number>();
  const newLines: string[] = [];
  for (const edge of graph.edges) {
    if (edge.from !== questionId)
      continue;
    removedLineIndexes.add(edge.lineIndex);
    const targetNode = graph.nodes.get(edge.to);
    const isImmediateChoice = targetNode?.kind === 'choice';
    if (!isImmediateChoice) {
      appendInlineDecl(edge, edge.to, graph, newLines);
      continue;
    }
    const choiceNodeId = edge.to;
    removedLineIndexes.add(targetNode!.lineIndex);
    for (const inner of graph.edges) {
      if (inner === edge)
        continue;
      const touchesChoice = inner.from === choiceNodeId || inner.to === choiceNodeId;
      if (!touchesChoice)
        continue;
      removedLineIndexes.add(inner.lineIndex);
      const otherEndpoint = inner.from === choiceNodeId ? inner.to : inner.from;
      if (otherEndpoint !== choiceNodeId)
        appendInlineDecl(inner, otherEndpoint, graph, newLines);
    }
  }
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
