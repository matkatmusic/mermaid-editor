import { codeBox } from './dom.ts';
import type { Edge } from './dom.ts';
import { phonePath, state } from './state.ts';

export function parentOf(id: string, edges: Edge[]) {
  let found: Edge | undefined;
  for (const edge of edges) {
    if (edge[1] === id) {
      found = edge;
      break;
    }
  }
  return found![0];
}

export function labelOf(id: string) {
  const trimmedLines = [];
  for (const s of codeBox.value.split('\n')) {
    trimmedLines.push(s.trim());
  }
  const shapePattern = /^[\[{(]/;
  let line;
  for (const s of trimmedLines) {
    const startsWithId = s.startsWith(id);
    const looksLikeNode = shapePattern.test(s.slice(id.length));
    const isMatch = startsWithId && looksLikeNode;
    if (isMatch) {
      line = s;
      break;
    }
  }
  if (!line)
    return id;
  const withoutId = line.slice(id.length);
  const withoutBrackets = withoutId.replace(/^[\[{(]+|[\]})]+$/g, '');
  return withoutBrackets.replace(/"/g, '');
}

export function contextualDecisionSliceIds(decisionId: string, edges: Edge[]) {
  const reversed = [decisionId];
  const visited = new Set(reversed);
  let node = decisionId;
  for (;;) {
    let incoming: Edge | undefined;
    for (const edge of edges) {
      const isMatch = edge[1] === node;
      if (isMatch) {
        incoming = edge;
        break;
      }
    }
    if (!incoming)
      break;
    const predecessor = incoming[0];
    if (visited.has(predecessor))
      break;
    reversed.push(predecessor);
    visited.add(predecessor);
    const isPreviousDecision = predecessor.startsWith('Q_') && !predecessor.startsWith('Q_CHOICE');
    if (isPreviousDecision)
      break;
    node = predecessor;
  }
  const ids = reversed.reverse();
  for (const choice of choicesOf(decisionId, edges)) {
    if (!visited.has(choice))
      ids.push(choice);
  }
  return ids;
}

export function sliceIds(edges: Edge[]) {
  const focusNodeId = state.functionsOnly ? null : state.phoneFocusNodeId;
  const hasFocusedDecisionContext = focusNodeId !== null && state.phoneFocusUsesDecisionContext;
  if (hasFocusedDecisionContext)
    return contextualDecisionSliceIds(focusNodeId, edges);
  const last = state.functionsOnly ? undefined : state.phonePreviewChoiceId ?? phonePath[phonePath.length - 1];
  const ids = focusNodeId
    ? [focusNodeId]
    : last
      ? [parentOf(last, edges), last]
      : [edges.map(([from]) => from).find(from => !edges.some(([, to]) => to === from))!];
  let node = ids[ids.length - 1];
  const visited = new Set(ids);
  for (;;) {
    const next = [];
    for (const [from, to] of edges) {
      if (from === node)
        next.push(to);
    }
    if (next.length === 0)
      return ids;
    if (next.length > 1)
      return ids.concat(next);
    node = next[0];
    if (visited.has(node))
      return ids;
    ids.push(node);
    visited.add(node);
  }
}

export function siblingIds(ids: string[], edges: Edge[]) {
  const hasDecisionContext = state.phoneFocusUsesDecisionContext || state.phonePreviewChoiceId || phonePath.length;
  if (!hasDecisionContext)
    return [];
  const found = [];
  for (const [from, to] of edges) {
    const isFromFirst = from === ids[0];
    const isNotSecond = to !== ids[1];
    const isSibling = isFromFirst && isNotSecond;
    if (isSibling)
      found.push(to);
  }
  return found;
}

export function choicesOf(id: string, edges: Edge[]) {
  const found = [];
  for (const [from, to] of edges) {
    if (from === id)
      found.push(to);
  }
  return found;
}


