import { codeBox, phoneDiagramBox } from './dom.ts';
import type { Edge } from './dom.ts';
import type { EditorGraph, EditorNode } from './editor-types.ts';
import { phonePath, state } from './state.ts';
import { choicesOf, siblingIds, sliceIds } from './graph-slice.ts';
import { buildClassStyleIndex, styleOfNode, type ClassStyleIndex } from './class-defs.ts';

const UNCLASSED_PHONE_STYLE = 'background:repeating-linear-gradient(45deg, #f4b4b4 0 8px, #fde8e8 8px 16px)';

// Rebuilt once per renderPhone() call (see bottom of this file) instead of per row.
let classIndex: ClassStyleIndex = { assignments: new Map(), defsByName: new Map() };

// Color now comes from the node's mermaid class, not state.typeColors/state.nodeTypes.
function getPhoneNodeAppearance(node: EditorNode) {
  const classStyle = styleOfNode(classIndex, node.id);
  if (!classStyle)
    return { boxStyle: UNCLASSED_PHONE_STYLE, labelStyle: '' };
  return { boxStyle: `background:${classStyle.fill};border:2px solid ${classStyle.stroke}`, labelStyle: '' };
}

function findRoot(edges: Edge[]) {
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

function encodeHtml(text: string) {
  const withAmp = text.replace(/&/g, '&amp;');
  const withLt = withAmp.replace(/</g, '&lt;');
  const withGt = withLt.replace(/>/g, '&gt;');
  const withQuote = withGt.replace(/"/g, '&quot;');
  return withQuote.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
}

function getLabelOf(id: string, graph: EditorGraph) {
  return graph.nodes.get(id)?.label ?? id;
}

type Row =
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

function buildRowsFromIdSequence(ids: string[], graph: EditorGraph, activeId: string, leadChosenId: string | undefined, leadDeclinedIds: string[]): Row[] {
  const rows: Row[] = [];
  const seen = new Set<string>();
  const leadQuestionId = ids[0];
  for (const id of ids) {
    const alreadySeen = seen.has(id);
    if (alreadySeen)
      continue;
    seen.add(id);
    const kind = graph.nodes.get(id)?.kind;
    const isChoice = kind === 'choice';
    if (isChoice)
      continue;
    const isBlock = kind === 'block';
    if (isBlock) {
      rows.push({ status: 'block', id });
      continue;
    }
    const isQuestion = kind === 'question';
    if (!isQuestion)
      continue;
    const isActive = id === activeId;
    if (isActive) {
      rows.push({ status: 'active', id });
      continue;
    }
    const isLeadQuestion = id === leadQuestionId;
    const hasLeadChoice = leadChosenId !== undefined;
    const isAnsweredLeadQuestion = isLeadQuestion && hasLeadChoice;
    if (isAnsweredLeadQuestion)
      rows.push({ status: 'past', id, chosenChoiceId: leadChosenId!, declinedChoiceIds: leadDeclinedIds });
  }
  return rows;
}

// Previews a main-view-clicked decision on the phone: masked lead-in, open focus, nothing revert-clickable.
function buildFocusRows(edges: Edge[], graph: EditorGraph, focusNodeId: string): Row[] {
  const ids = sliceIds(edges);
  const siblings = siblingIds(ids, edges);
  return buildRowsFromIdSequence(ids, graph, focusNodeId, ids[1], siblings);
}

function buildPreviewRows(edges: Edge[], graph: EditorGraph): Row[] {
  const ids = sliceIds(edges);
  const siblings = siblingIds(ids, edges);
  const reversedIds = [...ids].reverse();
  let activeId: string | undefined;
  for (const id of reversedIds) {
    const isQuestion = graph.nodes.get(id)?.kind === 'question';
    const isLeadQuestion = id === ids[0];
    const isEarlierQuestion = isQuestion && !isLeadQuestion;
    if (isEarlierQuestion) {
      activeId = id;
      break;
    }
  }
  return buildRowsFromIdSequence(ids, graph, activeId ?? ids[0], ids[1], siblings);
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

function buildRows(edges: Edge[], graph: EditorGraph): Row[] {
  const hasFocusedDecision = !state.functionsOnly && state.phoneFocusUsesDecisionContext && !!state.phoneFocusNodeId;
  if (hasFocusedDecision)
    return buildFocusRows(edges, graph, state.phoneFocusNodeId!);
  const hasPreviewChoice = !state.functionsOnly && !!state.phonePreviewChoiceId;
  if (hasPreviewChoice)
    return buildPreviewRows(edges, graph);
  return buildHistoryRows(edges, graph);
}

function buildChoiceButtonsHtml(choices: string[], row: Row, graph: EditorGraph) {
  const isPast = row.status === 'past';
  const declinedCount = choices.length - 1;
  const declinedPct = 30 / declinedCount;
  const buttons: string[] = [];
  for (const choiceId of choices) {
    const label = encodeHtml(getLabelOf(choiceId, graph));
    const isActive = row.status === 'active';
    if (isActive) {
      buttons.push(`<button type="button" class="phone-choice" data-node-id="${choiceId}" data-choose="${choiceId}">${label}</button>`);
      continue;
    }
    if (!isPast)
      continue;
    const isChosen = choiceId === row.chosenChoiceId;
    if (isChosen) {
      buttons.push(`<button type="button" class="phone-choice phone-choice-chosen" style="flex:0 1 70%" data-node-id="${choiceId}" disabled>${label}</button>`);
      continue;
    }
    const style = `style="flex:0 1 ${declinedPct}%"`;
    const canRevert = row.revertIndex !== undefined;
    if (canRevert)
      buttons.push(`<button type="button" class="phone-choice phone-choice-declined" ${style} data-node-id="${choiceId}" data-revert="${row.revertIndex}:${choiceId}">&#8634; ${label}</button>`);
    else
      buttons.push(`<button type="button" class="phone-choice phone-choice-declined" ${style} data-node-id="${choiceId}" disabled>${label}</button>`);
  }
  return `<div class="phone-choice-row">${buttons.join('')}</div>`;
}

function buildRowHtml(row: Row, graph: EditorGraph, edges: Edge[], isMasked: boolean): string {
  const node = graph.nodes.get(row.id);
  if (!node)
    return '';
  if (row.status === 'block') {
    const blockClass = isMasked ? 'phone-block phone-block-past' : 'phone-block';
    const { boxStyle, labelStyle } = getPhoneNodeAppearance(node);
    return `<div class="${blockClass}" data-node-id="${row.id}" style="${boxStyle}"><span style="${labelStyle}">${encodeHtml(getLabelOf(row.id, graph))}</span></div>`;
  }
  const choices = choicesOf(row.id, edges);
  const activeAttr = row.status === 'active' ? ' data-active-question' : '';
  const { boxStyle: questionBoxStyle, labelStyle: questionLabelStyle } = getPhoneNodeAppearance(node);
  const question = `<div class="phone-question" data-node-id="${row.id}"${activeAttr} style="${questionBoxStyle}"><span style="${questionLabelStyle}">${encodeHtml(getLabelOf(row.id, graph))}</span></div>`;
  const wrapClass = isMasked ? 'phone-decision phone-decision-past' : 'phone-decision';
  return `<div class="${wrapClass}">${question}${buildChoiceButtonsHtml(choices, row, graph)}</div>`;
}

export function renderPhone(edges: Edge[], graph: EditorGraph) {
  classIndex = buildClassStyleIndex(codeBox.value);
  const rows = buildRows(edges, graph);
  let lastPastIndex = -1;
  let hasOpenQuestion = false;
  for (let i = 0; i < rows.length; i++) {
    const isPast = rows[i].status === 'past';
    if (isPast)
      lastPastIndex = i;
    const isOpenQuestion = rows[i].status === 'active';
    if (isOpenQuestion)
      hasOpenQuestion = true;
  }
  // A finished path has no open question, so everything scrolls.
  const historyParts: string[] = [];
  const footerParts: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const isMasked = i <= lastPastIndex;
    const html = buildRowHtml(rows[i], graph, edges, isMasked);
    const isAfterLastAnswer = i > lastPastIndex;
    const isFixedInPlace = isAfterLastAnswer ? hasOpenQuestion : false;
    const target = isFixedInPlace ? footerParts : historyParts;
    target.push(html);
  }
  const hasFixedRows = footerParts.length > 0;
  if (lastPastIndex >= 0) {
    if (hasFixedRows)
      footerParts.unshift('<hr class="phone-separator">');
  }
  const hasAnswer = phonePath.length > 0;
  const topBar = hasAnswer ? '<div id="phoneTopBar"><button type="button" class="phone-undo" data-undo>&#8630; Undo decision</button><button type="button" class="phone-undo" data-reset-decisions>Reset decisions</button><button type="button" class="phone-undo" data-write-path>Write chosen path</button></div>' : '';
  phoneDiagramBox.innerHTML = `${topBar}<div id="phoneHistory">${historyParts.join('')}</div><div id="phoneFooter">${footerParts.join('')}</div>`;
  const historyBox = phoneDiagramBox.querySelector<HTMLElement>('#phoneHistory');
  if (historyBox)
    historyBox.scrollTop = historyBox.scrollHeight;
}
