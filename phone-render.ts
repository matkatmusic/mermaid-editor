import { phoneDiagramBox } from './dom.ts';
import type { Edge } from './dom.ts';
import type { EditorGraph } from './editor-types.ts';
import { phonePath, state } from './state.ts';
import { choicesOf, siblingIds, sliceIds } from './graph-slice.ts';
import { colorForNode } from './node-type-colors.ts';

function rootOf(edges: Edge[]) {
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

function escapeHtml(text: string) {
  const withAmp = text.replace(/&/g, '&amp;');
  const withLt = withAmp.replace(/</g, '&lt;');
  const withGt = withLt.replace(/>/g, '&gt;');
  const withQuote = withGt.replace(/"/g, '&quot;');
  return withQuote.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
}

function labelOf(id: string, graph: EditorGraph) {
  return graph.nodes.get(id)?.label ?? id;
}

type Row =
  | { status: 'block'; id: string }
  | { status: 'active'; id: string }
  | { status: 'past'; id: string; chosenChoiceId: string; declinedChoiceIds: string[]; revertIndex?: number };

// Walks answered history from the root in phonePath order, so every past decision renders masked.
function historyRows(edges: Edge[], graph: EditorGraph): Row[] {
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
  let cur = rootOf(edges);
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

function rowsFromIdSequence(ids: string[], graph: EditorGraph, activeId: string, leadChosenId: string | undefined, leadDeclinedIds: string[]): Row[] {
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
function focusRows(edges: Edge[], graph: EditorGraph, focusNodeId: string): Row[] {
  const ids = sliceIds(edges);
  const siblings = siblingIds(ids, edges);
  return rowsFromIdSequence(ids, graph, focusNodeId, ids[1], siblings);
}

function previewRows(edges: Edge[], graph: EditorGraph): Row[] {
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
  return rowsFromIdSequence(ids, graph, activeId ?? ids[0], ids[1], siblings);
}

function buildRows(edges: Edge[], graph: EditorGraph): Row[] {
  const hasFocusedDecision = !state.functionsOnly && state.phoneFocusUsesDecisionContext && !!state.phoneFocusNodeId;
  if (hasFocusedDecision)
    return focusRows(edges, graph, state.phoneFocusNodeId!);
  const hasPreviewChoice = !state.functionsOnly && !!state.phonePreviewChoiceId;
  if (hasPreviewChoice)
    return previewRows(edges, graph);
  return historyRows(edges, graph);
}

function choiceButtonsHtml(choices: string[], row: Row, graph: EditorGraph) {
  const isPast = row.status === 'past';
  const declinedCount = choices.length - 1;
  const declinedPct = 30 / declinedCount;
  const buttons: string[] = [];
  for (const choiceId of choices) {
    const label = escapeHtml(labelOf(choiceId, graph));
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

function rowHtml(row: Row, graph: EditorGraph, edges: Edge[], isMasked: boolean): string {
  const node = graph.nodes.get(row.id);
  if (!node)
    return '';
  if (row.status === 'block') {
    const blockClass = isMasked ? 'phone-block phone-block-past' : 'phone-block';
    return `<div class="${blockClass}" data-node-id="${row.id}" style="background:${colorForNode(node)}">${escapeHtml(labelOf(row.id, graph))}</div>`;
  }
  const choices = choicesOf(row.id, edges);
  const activeAttr = row.status === 'active' ? ' data-active-question' : '';
  const question = `<div class="phone-question" data-node-id="${row.id}"${activeAttr} style="background:${colorForNode(node)}">${escapeHtml(labelOf(row.id, graph))}</div>`;
  const wrapClass = isMasked ? 'phone-decision phone-decision-past' : 'phone-decision';
  return `<div class="${wrapClass}">${question}${choiceButtonsHtml(choices, row, graph)}</div>`;
}

export function renderPhone(edges: Edge[], graph: EditorGraph) {
  const rows = buildRows(edges, graph);
  let lastPastIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const isPast = rows[i].status === 'past';
    if (isPast)
      lastPastIndex = i;
  }
  // History (already-answered decisions) scrolls; everything after the last answer is fixed in place.
  const historyParts: string[] = [];
  const footerParts: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const isMasked = i <= lastPastIndex;
    const html = rowHtml(rows[i], graph, edges, isMasked);
    const target = i <= lastPastIndex ? historyParts : footerParts;
    target.push(html);
  }
  if (lastPastIndex >= 0)
    footerParts.unshift('<hr class="phone-separator">');
  phoneDiagramBox.innerHTML = `<div id="phoneHistory">${historyParts.join('')}</div><div id="phoneFooter">${footerParts.join('')}</div>`;
  const historyBox = phoneDiagramBox.querySelector<HTMLElement>('#phoneHistory');
  if (historyBox)
    historyBox.scrollTop = historyBox.scrollHeight;
}
