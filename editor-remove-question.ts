import { state } from './state.ts';
import type { EditorGraph } from './editor-types.ts';
import { getEditorGraph } from './editor-graph.ts';
import { appendInlineDecl, buildSourceWithLinesReplaced } from './source-edit.ts';
import { applyEditorSource, executeEditorAction, selectEditorNode, renderRemovalPreview } from './editor-actions.ts';
import { nodeActions } from './dom.ts';

export function removeQuestion() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const questionId = state.selectedEditorNodeId;
  const choices: string[] = [];
  for (const edge of graph.edges) {
    if (edge.from === questionId)
      choices.push(edge.to);
  }
  state.pendingRemoval = { questionId, choices, index: 0 };
  const hasNoChoices = !choices.length;
  if (hasNoChoices) {
    applyQuestionRemoval();
    return;
  }
  nodeActions.classList.add('removing');
  renderRemovalPreview();
}

export function moveRemovalPreview() {
  if (!state.pendingRemoval)
    return;
  state.pendingRemoval.index = (state.pendingRemoval.index + 1) % state.pendingRemoval.choices.length;
  renderRemovalPreview();
}

export function clearQuestionRemoval() {
  selectEditorNode(null);
}

export function applyQuestionRemoval() {
  if (!state.pendingRemoval)
    return;
  const { questionId, choices, index } = state.pendingRemoval;
  const graph = getEditorGraph();
  if (!choices.length)
    // Clear selection before committing so the saved metadata doesn't point at the node this removes.
    selectEditorNode(null);
  const newSource = buildQuestionRemovedSource(graph, questionId, choices, index);
  function applyRemovedQuestionSource() {
    return applyEditorSource(newSource);
  }
  executeEditorAction(applyRemovedQuestionSource);
}

export function buildQuestionRemovedSource(graph: EditorGraph, questionId: string, choices: string[], index: number) {
  const removedLineIndexes = new Set<number>();
  const newLines: string[] = [];
  const qNode = graph.nodes.get(questionId);
  if (qNode)
    removedLineIndexes.add(qNode.lineIndex);
  const predecessors: string[] = [];
  for (const edge of graph.edges) {
    if (edge.to !== questionId)
      continue;
    predecessors.push(edge.from);
    removedLineIndexes.add(edge.lineIndex);
    appendInlineDecl(edge, edge.from, graph, newLines);
  }
  let keepSuccessor = choices[index];
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
    removedLineIndexes.add(targetNode!.lineIndex);
    for (const inner of graph.edges) {
      if (inner.from !== edge.to)
        continue;
      removedLineIndexes.add(inner.lineIndex);
      if (edge.to === keepSuccessor) {
        appendInlineDecl(inner, inner.to, graph, newLines);
        keepSuccessor = inner.to;
      }
    }
  }
  if (keepSuccessor) {
    for (const predecessor of predecessors)
      newLines.push(`  ${predecessor} --> ${keepSuccessor}`);
  }
  return buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines);
}
