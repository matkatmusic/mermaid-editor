import { state } from './state.ts';
import { getEditorGraph } from './editor-graph.ts';
import { getDeclarationSuffix } from './editor-parse.ts';
import { setEditorActionPromise } from './editor-metadata.ts';
import { appendInlineDecl, buildChoiceId, buildSourceWithLinesReplaced, getNextEditorId } from './source-edit.ts';
import { applyEditorSource } from './editor-actions.ts';
import type { EditorEdge } from './editor-types.ts';

export function addQuestionAfter() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const selected = state.selectedEditorNodeId;
  const removedLineIndexes = new Set<number>();
  const successors: string[] = [];
  for (const edge of graph.edges) {
    if (edge.from !== selected)
      continue;
    successors.push(edge.to);
    removedLineIndexes.add(edge.lineIndex);
  }
  const qId = getNextEditorId('Q_NEW', graph);
  const yesId = buildChoiceId(qId, 'Y');
  const noId = buildChoiceId(qId, 'N');
  const newLines = [
    `  ${selected} --> ${qId}`,
    `  ${qId}{"New question"}`,
    `  ${yesId}["Yes"]`,
    `  ${noId}["No"]`,
    `  ${qId} --> ${yesId}`,
    `  ${qId} --> ${noId}`,
  ];
  for (const edge of graph.edges) {
    if (edge.from !== selected)
      continue;
    appendInlineDecl(edge, edge.to, graph, newLines);
  }
  for (const successor of successors) {
    newLines.push(`  ${yesId} --> ${successor}`);
    newLines.push(`  ${noId} --> ${successor}`);
  }
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}

export function addBlockAfter() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const selected = state.selectedEditorNodeId;
  const removedLineIndexes = new Set<number>();
  const successors: string[] = [];
  const newLines: string[] = [];
  for (const edge of graph.edges) {
    if (edge.from !== selected)
      continue;
    successors.push(edge.to);
    removedLineIndexes.add(edge.lineIndex);
    appendInlineDecl(edge, edge.to, graph, newLines);
  }
  const bId = getNextEditorId('B_NEW', graph);
  newLines.unshift(`  ${selected} --> ${bId}`, `  ${bId}["New block"]`);
  for (const successor of successors)
    newLines.push(`  ${bId} --> ${successor}`);
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}

export function getChoiceSuffixFromLabel(label: string) {
  const upperLabel = label.trim().toUpperCase();
  const underscored = upperLabel.replace(/[^A-Z0-9]+/g, '_');
  const trimmed = underscored.replace(/^_+|_+$/g, '');
  return trimmed || 'CHOICE';
}

export function addChoice() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const questionId = state.selectedEditorNodeId;
  let labelled: EditorEdge | undefined;
  for (const edge of graph.edges) {
    const isFromQuestion = edge.from === questionId;
    const hasLabel = !!edge.label;
    const isLabelled = isFromQuestion && hasLabel;
    if (isLabelled) {
      labelled = edge;
      break;
    }
  }
  const removedLineIndexes = new Set<number>();
  const newLines: string[] = [];
  if (labelled) {
    removedLineIndexes.add(labelled.lineIndex);
    const suffix = getChoiceSuffixFromLabel(labelled.label!);
    const cid = buildChoiceId(questionId, suffix);
    const targetNode = graph.nodes.get(labelled.to);
    const isTargetOnEdgeLine = targetNode?.lineIndex === labelled.lineIndex;
    const targetSuffix = isTargetOnEdgeLine ? getDeclarationSuffix(targetNode!) : '';
    newLines.push(
      `  ${cid}["${labelled.label}"]`,
      `  ${questionId} --> ${cid}`,
      `  ${cid} --> ${labelled.to}${targetSuffix}`,
    );
  }
  else {
    let suffix = 'NEW';
    let n = 1;
    while (graph.nodes.has(buildChoiceId(questionId, suffix)))
      suffix = 'NEW' + (++n);
    const cid = buildChoiceId(questionId, suffix);
    newLines.push(`  ${cid}["New choice"]`, `  ${questionId} --> ${cid}`);
  }
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
