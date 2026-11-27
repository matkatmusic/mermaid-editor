import type { Edge } from './dom.ts';
import type { EditorGraph, EditorNode } from './editor-types.ts';
import { phonePath, state } from './state.ts';
import { choicesOf, parentOf } from './graph-slice.ts';

// Every start node (no incoming edge), in the order the edges list them.
export function findRoots(edges: Edge[]) {
  const roots: string[] = [];
  for (const [candidate] of edges) {
    let hasIncoming = false;
    for (const [, to] of edges) {
      const targetsCandidate = to === candidate;
      if (targetsCandidate) {
        hasIncoming = true;
        break;
      }
    }
    const isNewRoot = !hasIncoming && !roots.includes(candidate);
    if (isNewRoot)
      roots.push(candidate);
  }
  return roots;
}

// The first start node: where the phone starts before any answer.
export function findRoot(edges: Edge[]) {
  return findRoots(edges)[0];
}

// With several start nodes and no click yet, the phone shows a prompt instead of rows.
export function isPhoneAwaitingStartNode(edges: Edge[]) {
  const roots = findRoots(edges);
  const hasSeveralStartNodes = roots.length > 1;
  if (!hasSeveralStartNodes)
    return false;
  const hasNoAnswers = phonePath.length === 0;
  if (!hasNoAnswers)
    return false;
  return !roots.includes(state.phoneStartNodeId!);
}

// A click on any main-view node: the phone shows the path from a start node to it, then walks on to the next open decision.
export function selectPhonePathToNode(nodeId: string, edges: Edge[], graph: EditorGraph) {
  const isChoice = graph.nodes.get(nodeId)?.kind === 'choice';
  const targetId = isChoice ? parentOf(nodeId, edges) : nodeId;
  let startNodeId: string | undefined;
  let answers: string[] | undefined;
  for (const root of findRoots(edges)) {
    answers = findAnswersFromRoot(root, targetId, edges, graph);
    if (answers) {
      startNodeId = root;
      break;
    }
  }
  if (!answers)
    throw new Error(`No phone path leads from a start node to ${nodeId}`);
  phonePath.length = 0;
  phonePath.push(...answers);
  if (isChoice)
    phonePath.push(nodeId);
  state.phoneStartNodeId = startNodeId!;
  state.phoneClickedNodeId = nodeId;
  state.phoneClickedAtMs = Date.now();
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
}

// The clicked start node when there is one; otherwise the start node that leads to the first answer.
function findHistoryRoot(edges: Edge[], graph: EditorGraph) {
  const roots = findRoots(edges);
  const isClickedStartNodeKnown = roots.includes(state.phoneStartNodeId!);
  if (isClickedStartNodeKnown)
    return state.phoneStartNodeId!;
  const hasNoAnswers = phonePath.length === 0;
  if (hasNoAnswers)
    return roots[0];
  const firstAnsweredQuestion = parentOf(phonePath[0], edges);
  for (const root of roots) {
    const answers = findAnswersFromRoot(root, firstAnsweredQuestion, edges, graph);
    if (answers)
      return root;
  }
  return roots[0];
}

export type Row =
  | { status: 'block'; id: string }
  | { status: 'active'; id: string }
  | { status: 'past'; id: string; chosenChoiceId: string; declinedChoiceIds: string[]; revertIndex?: number };

function compareNodesByLine(a: EditorNode, b: EditorNode) {
  return a.lineIndex - b.lineIndex;
}

// Walks answered history from the root in phonePath order, so every past decision renders masked. Single-choice questions answer themselves.
export function buildHistoryRows(edges: Edge[], graph: EditorGraph): Row[] {
  if (edges.length === 0) {
    // No edges to walk (e.g. a single declared node): show every declared node standalone.
    const sorted = [...graph.nodes.values()].sort(compareNodesByLine);
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
  let cur: string | undefined = findHistoryRoot(edges, graph);
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
      const isSingleChoice = choices.length === 1;
      if (!hasAnswer && !isSingleChoice) {
        rows.push({ status: 'active', id: cur });
        break;
      }
      const answered = hasAnswer ? phonePath[pathIndex] : choices[0];
      const declinedChoiceIds: string[] = [];
      for (const choiceId of choices) {
        const isChosen = choiceId === answered;
        if (!isChosen)
          declinedChoiceIds.push(choiceId);
      }
      rows.push({ status: 'past', id: cur, chosenChoiceId: answered, declinedChoiceIds, revertIndex: pathIndex });
      if (hasAnswer)
        pathIndex++;
      const isAnswerAChoice = graph.nodes.get(answered)?.kind === 'choice';
      cur = isAnswerAChoice ? choicesOf(answered, edges)[0] : answered;
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

// Shortest answer list that buildHistoryRows walks from any start node to questionId.
export function findAnswersLeadingTo(questionId: string, edges: Edge[], graph: EditorGraph): string[] {
  for (const root of findRoots(edges)) {
    const answers = findAnswersFromRoot(root, questionId, edges, graph);
    if (answers) {
      state.phoneStartNodeId = root;
      return answers;
    }
  }
  throw new Error(`No phone path leads from the start to ${questionId}`);
}

// Every block, decision and choice id on the shortest route from a start node to nodeId.
export function findRouteIdsToNode(nodeId: string, edges: Edge[], graph: EditorGraph): string[] {
  const isChoice = graph.nodes.get(nodeId)?.kind === 'choice';
  const targetId = isChoice ? parentOf(nodeId, edges) : nodeId;
  for (const root of findRoots(edges)) {
    const walk = findWalkFromRoot(root, targetId, edges, graph);
    if (walk) {
      if (isChoice)
        return [...walk.routeIds, nodeId];
      return walk.routeIds;
    }
  }
  throw new Error(`No route leads from a start block to ${nodeId}`);
}

function findAnswersFromRoot(root: string, questionId: string, edges: Edge[], graph: EditorGraph): string[] | undefined {
  return findWalkFromRoot(root, questionId, edges, graph)?.answers;
}

function findWalkFromRoot(root: string, questionId: string, edges: Edge[], graph: EditorGraph): { answers: string[]; routeIds: string[] } | undefined {
  // const queue: { nodeId: string | undefined; answers: string[] }[] = [{ nodeId: root, answers: [] }];
  const queue: { nodeId: string | undefined; answers: string[]; routeIds: string[] }[] = [{ nodeId: root, answers: [], routeIds: [] }];
  const visited = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    // const { nodeId, answers } = queue[i];
    const { nodeId, answers, routeIds } = queue[i];
    if (nodeId === undefined)
      continue;
    if (nodeId === questionId)
      // return answers;
      return { answers, routeIds: [...routeIds, nodeId] };
    const isVisited = visited.has(nodeId);
    if (isVisited)
      continue;
    visited.add(nodeId);
    const isQuestion = graph.nodes.get(nodeId)?.kind === 'question';
    if (isQuestion) {
      for (const choiceId of choicesOf(nodeId, edges)) {
        const isChoiceAQuestion = graph.nodes.get(choiceId)?.kind === 'question';
        const nextNodeId = isChoiceAQuestion ? choiceId : choicesOf(choiceId, edges)[0];
        const nextRouteIds = isChoiceAQuestion ? [...routeIds, nodeId] : [...routeIds, nodeId, choiceId];
        // queue.push({ nodeId: nextNodeId, answers: [...answers, choiceId] });
        queue.push({ nodeId: nextNodeId, answers: [...answers, choiceId], routeIds: nextRouteIds });
      }
      continue;
    }
    const nexts = choicesOf(nodeId, edges);
    const isSingleChain = nexts.length === 1;
    if (isSingleChain)
      // queue.push({ nodeId: nexts[0], answers });
      queue.push({ nodeId: nexts[0], answers, routeIds: [...routeIds, nodeId] });
  }
  return undefined;
}
