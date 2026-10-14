import type { Edge } from './dom.ts';
import type { EditorGraph } from './editor-types.ts';
import { phonePath, state } from './state.ts';
import { choicesOf } from './graph-slice.ts';

export function findRoot(edges: Edge[]) {
  for (const [candidate] of edges) {
    let hasIncoming = false;
    for (const [, to] of edges) {
      const targetsCandidate = to === candidate;
      if (targetsCandidate) {
        hasIncoming = true;
        break;
      }
    }
    if (!hasIncoming)
      return candidate;
  }
  return undefined;
}

export type Row =
  | { status: 'block'; id: string }
  | { status: 'active'; id: string }
  | { status: 'past'; id: string; chosenChoiceId: string; declinedChoiceIds: string[]; revertIndex?: number };

// Walks answered history from the root in phonePath order, so every past decision renders masked.
export function buildHistoryRows(edges: Edge[], graph: EditorGraph): Row[] {
  if (edges.length === 0) {
    // No edges to walk (e.g. a single declared node): show every declared node standalone.
    const sorted = [...graph.nodes.values()].sort((a, b) => a.lineIndex - b.lineIndex);
    const standaloneRows: Row[] = [];
    for (const node of sorted) {
      const isBlock = node.kind === 'block';
      if (isBlock)
        standaloneRows.push({ status: 'block', id: node.id });
      else
        standaloneRows.push({ status: 'active', id: node.id });
    }
    return standaloneRows;
  }
  const rows: Row[] = [];
  let cur = findRoot(edges);
  let pathIndex = 0;
  // A loop can revisit a node, adding a new row each time; maxSteps only bounds a pure block cycle.
  const maxSteps = graph.nodes.size + phonePath.length + 1;
  for (let step = 0; step < maxSteps; step++) {
    if (cur === undefined)
      break;
    const kind = graph.nodes.get(cur)?.kind ?? 'block';
    if (kind === 'question') {
      const choices = choicesOf(cur, edges);
      const hasAnswer = pathIndex < phonePath.length && choices.includes(phonePath[pathIndex]);
      if (!hasAnswer) {
        rows.push({ status: 'active', id: cur });
        break;
      }
      const answered = phonePath[pathIndex];
      const declinedChoiceIds: string[] = [];
      for (const choiceId of choices) {
        const isChosen = choiceId === answered;
        if (!isChosen)
          declinedChoiceIds.push(choiceId);
      }
      rows.push({ status: 'past', id: cur, chosenChoiceId: answered, declinedChoiceIds, revertIndex: pathIndex });
      pathIndex++;
      cur = choicesOf(answered, edges)[0];
      continue;
    }
    if (kind === 'block')
      rows.push({ status: 'block', id: cur });
    const nexts = choicesOf(cur, edges);
    const isSingleChain = nexts.length === 1;
    cur = isSingleChain ? nexts[0] : undefined;
  }
  return rows;
}

export function isPhoneShowingHistory() {
  const hasFocusedDecision = !state.functionsOnly && state.phoneFocusUsesDecisionContext && !!state.phoneFocusNodeId;
  const hasPreviewChoice = !state.functionsOnly && !!state.phonePreviewChoiceId;
  return !hasFocusedDecision && !hasPreviewChoice;
}

// Shortest answer list that buildHistoryRows walks from the root to questionId.
export function findAnswersLeadingTo(questionId: string, edges: Edge[], graph: EditorGraph): string[] {
  const root = findRoot(edges);
  const queue: { nodeId: string | undefined; answers: string[] }[] = [{ nodeId: root, answers: [] }];
  const visited = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const { nodeId, answers } = queue[i];
    if (nodeId === undefined)
      continue;
    if (nodeId === questionId)
      return answers;
    const isVisited = visited.has(nodeId);
    if (isVisited)
      continue;
    visited.add(nodeId);
    const isQuestion = graph.nodes.get(nodeId)?.kind === 'question';
    if (isQuestion) {
      for (const choiceId of choicesOf(nodeId, edges))
        queue.push({ nodeId: choicesOf(choiceId, edges)[0], answers: [...answers, choiceId] });
      continue;
    }
    const nexts = choicesOf(nodeId, edges);
    const isSingleChain = nexts.length === 1;
    if (isSingleChain)
      queue.push({ nodeId: nexts[0], answers });
  }
  throw new Error(`No phone path leads from the start to ${questionId}`);
}
