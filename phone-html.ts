import { codeBox, phoneDiagramBox } from './dom.ts';
import type { Edge } from './dom.ts';
import type { EditorGraph, EditorNode } from './editor-types.ts';
import { phonePath } from './state.ts';
import { choicesOf } from './graph-slice.ts';
import { buildClassStyleIndex, styleOfNode, type ClassStyleIndex } from './class-defs.ts';
import type { Row } from './phone-render.ts';
import { buildRows } from './phone-rows.ts';

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
  const topBar = hasAnswer ? '<div id="phoneTopBar"><button type="button" class="phone-undo" data-undo>&#8630; Undo</button><button type="button" class="phone-undo" data-reset-decisions>Reset decisions</button><button type="button" class="phone-undo" data-write-path>Write chosen path</button></div>' : '';
  phoneDiagramBox.innerHTML = `${topBar}<div id="phoneHistory">${historyParts.join('')}</div><div id="phoneFooter">${footerParts.join('')}</div>`;
  const historyBox = phoneDiagramBox.querySelector<HTMLElement>('#phoneHistory');
  if (historyBox)
    historyBox.scrollTop = historyBox.scrollHeight;
}
