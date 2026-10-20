import { codeBox, diagramBox, errorBox, errorLog } from './dom.ts';
import type { Edge } from './dom.ts';
import { chosenAnswers } from './state.ts';
import { parseEdges } from './diagram-source.ts';

export function findTrail(edges: Edge[]) {
  const bright = new Set<string>();
  const visited = new Set<string>();
  let node: string | undefined = edges[0][0];
  for (;;) {
    const hasNode = !!node;
    if (!hasNode)
      break;
    const notVisited = !visited.has(node!);
    if (!notVisited)
      break;
    visited.add(node!);
    bright.add(node!);
    const nextNodes = [];
    for (const [from, to] of edges) {
      if (from === node)
        nextNodes.push(to);
    }
    if (nextNodes.length <= 1) {
      node = nextNodes[0];
      continue;
    }
    let chosen: string | undefined;
    for (const option of nextNodes) {
      const isChosen = chosenAnswers.has(option);
      if (isChosen) {
        chosen = option;
        break;
      }
    }
    node = chosen;
    if (!node)
      for (const option of nextNodes)
        bright.add(option);
  }
  return bright;
}

export function applyPathHighlight() {
  const svgNodes = diagramBox.querySelectorAll('g.node');
  const svgEdges = diagramBox.querySelectorAll('path.flowchart-link');
  const edges = parseEdges(codeBox.value);
  const bright = chosenAnswers.size ? findTrail(edges) : null;
  const isDim = (id: string | undefined) => bright !== null && !bright.has(id!);
  for (const el of svgNodes)
    el.classList.toggle('dim', isDim(getNodeId(el)));
  for (const el of svgEdges) {
    const [from, to] = getEdgeEnds(el, edges);
    el.classList.toggle('dim', isDim(from) || isDim(to));
  }
}

export function getEdgeEnds(el: Element, edges: Edge[]) {
  let found;
  for (const edge of edges) {
    const isEdgeElement = el.id.includes('L_' + edge[0] + '_' + edge[1] + '_');
    if (isEdgeElement) {
      found = edge;
      break;
    }
  }
  return found || [];
}

export function getNodeId(el: Element) {
  return el.id.replace(/^.*flowchart-/, '').replace(/-\d+$/, '');
}

export function isAnswerId(id: string, edges: Edge[]) {
  let matched = false;
  for (const [from, to] of edges) {
    const targetsId = to === id;
    const fromIsQuestion = from.startsWith('Q_');
    const fromIsDecision = fromIsQuestion && !from.startsWith('Q_CHOICE');
    const idIsQuestion = id.startsWith('Q_') && !id.startsWith('Q_CHOICE');
    const idIsAnswerOfFrom = id.startsWith('Q_CHOICE_' + from.replace(/^Q_/, '') + '_') || (fromIsDecision && idIsQuestion);
    const isMatch = targetsId && fromIsQuestion && idIsAnswerOfFrom;
    if (isMatch) {
      matched = true;
      break;
    }
  }
  return matched;
}

export function moveToNextQuestion(edges: Edge[]) {
  const bright = [...findTrail(edges)];
  bright.reverse();
  let nextQuestion;
  for (const id of bright) {
    const isQuestion = id.startsWith('Q_');
    const isAnswer = isAnswerId(id, edges);
    const isUnansweredQuestion = isQuestion && !isAnswer;
    if (isUnansweredQuestion) {
      nextQuestion = id;
      break;
    }
  }
  if (!nextQuestion)
    return;
  const el = diagramBox.querySelector('[id*="flowchart-' + nextQuestion + '-"]');
  if (el)
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function reportEditorValidationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  errorBox.textContent = message;
  errorLog.textContent = message + '\n';
  errorLog.classList.add('open');
  errorLog.scrollTop = errorLog.scrollHeight;
}

