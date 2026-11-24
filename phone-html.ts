import { codeBox, phoneDiagramBox } from './dom.ts';
import type { Edge } from './dom.ts';
import type { EditorGraph, EditorNode } from './editor-types.ts';
import { phonePath, state } from './state.ts';
import { choicesOf } from './graph-slice.ts';
import { buildClassStyleIndex, findNodeStyle, type ClassStyleIndex } from './class-style-index.ts';
import { isPhoneAwaitingStartNode, isPhoneShowingHistory, type Row } from './phone-render.ts';
import { buildRows } from './phone-rows.ts';
import { decodeLabelQuotes } from './editor-parse.ts';
import { getNodeAlign } from './node-align.ts';
import { CODE_BLOCK_STYLE, CODE_LINE_BREAK_PATTERN, FENCED_CODE_BLOCK_PATTERN } from './label-code.ts';

// How long after a click the phone keeps the animated border on the clicked node; matches the CSS animation length.
const PHONE_CLICKED_BORDER_MS = 3000;

const UNCLASSED_PHONE_STYLE = 'background:repeating-linear-gradient(45deg, #f4b4b4 0 8px, #fde8e8 8px 16px)';

// Rebuilt once per renderPhone() call (see bottom of this file) instead of per row.
let classIndex: ClassStyleIndex = { assignments: new Map(), defsByName: new Map() };

// Color now comes from the node's mermaid class, not state.typeColors/state.nodeTypes.
function getPhoneNodeAppearance(node: EditorNode, graph: EditorGraph) {
  const classStyle = findNodeStyle(classIndex, node.id);
  const textAlignStyle = `;text-align:${getNodeAlign(graph.lines, node.id).justification}`;
  if (!classStyle)
    return { boxStyle: UNCLASSED_PHONE_STYLE + textAlignStyle, labelStyle: '' };
  return { boxStyle: `background:${classStyle.fill};border:2px solid ${classStyle.stroke}${textAlignStyle}`, labelStyle: '' };
}

function encodeHtml(text: string) {
  const withAmp = text.replace(/&/g, '&amp;');
  const withLt = withAmp.replace(/</g, '&lt;');
  const withGt = withLt.replace(/>/g, '&gt;');
  const withQuote = withGt.replace(/"/g, '&quot;');
  return withQuote.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
}

function getLabelOf(id: string, graph: EditorGraph) {
  return decodeLabelQuotes(graph.nodes.get(id)?.label ?? id);
}

// Text in single backticks shows as a code span; the backticks stay in the file.
// The lines between two fences of three backticks show as one left-justified code block.
function getLabelHtml(id: string, graph: EditorGraph) {
  const pieces = getLabelOf(id, graph).split(FENCED_CODE_BLOCK_PATTERN);
  const htmlPieces: string[] = [];
  for (const [index, piece] of pieces.entries()) {
    const isCodeBlock = index % 2 === 1;
    if (isCodeBlock) {
      const codeLines = piece.split(CODE_LINE_BREAK_PATTERN).map(encodeHtml);
      htmlPieces.push(`<code class="phone-code-block" style="${CODE_BLOCK_STYLE}">${codeLines.join('<br>')}</code>`);
      continue;
    }
    htmlPieces.push(encodeHtml(piece).replace(/\\n/g, '<br>').replace(/`([^`]+)`/g, '<code>$1</code>'));
  }
  return htmlPieces.join('');
}

function buildChoiceButtonsHtml(choices: string[], row: Row, graph: EditorGraph) {
  const isPast = row.status === 'past';
  const declinedCount = choices.length - 1;
  const declinedPct = 30 / declinedCount;
  const buttons: string[] = [];
  for (const choiceId of choices) {
    const label = getLabelHtml(choiceId, graph);
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
    const { boxStyle, labelStyle } = getPhoneNodeAppearance(node, graph);
    return `<div class="${blockClass}" data-node-id="${row.id}" style="${boxStyle}"><span style="${labelStyle}">${getLabelHtml(row.id, graph)}</span></div>`;
  }
  const choices = choicesOf(row.id, edges);
  const activeAttr = row.status === 'active' ? ' data-active-question' : '';
  const { boxStyle: questionBoxStyle, labelStyle: questionLabelStyle } = getPhoneNodeAppearance(node, graph);
  const question = `<div class="phone-question" data-node-id="${row.id}"${activeAttr} style="${questionBoxStyle}"><span style="${questionLabelStyle}">${getLabelHtml(row.id, graph)}</span></div>`;
  const wrapClass = isMasked ? 'phone-decision phone-decision-past' : 'phone-decision';
  const isAutoPicked = row.status === 'past' && choices.length === 1;
  const buttonsHtml = isAutoPicked ? '' : buildChoiceButtonsHtml(choices, row, graph);
  return `<div class="${wrapClass}">${question}<div class="phone-choice-count">${choices.length} choices</div>${buttonsHtml}</div>`;
}

export function renderPhone(edges: Edge[], graph: EditorGraph) {
  classIndex = buildClassStyleIndex(codeBox.value);
  if (isPhoneShowingHistory()) {
    if (isPhoneAwaitingStartNode(edges)) {
      phoneDiagramBox.innerHTML = '<div id="phoneStartPrompt">Select a starting node to walk a path through that diagram</div>';
      return;
    }
  }
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
  const topBar = hasAnswer ? '<div id="phoneTopBar"><button type="button" class="phone-undo" data-undo>&#8630; Undo</button><button type="button" class="phone-undo" data-reset-decisions>Reset decisions</button><button type="button" class="phone-undo" data-write-path>Write path</button></div>' : '';
  phoneDiagramBox.innerHTML = `${topBar}<div id="phoneHistory">${historyParts.join('')}</div><div id="phoneFooter">${footerParts.join('')}</div>`;
  const historyBox = phoneDiagramBox.querySelector<HTMLElement>('#phoneHistory');
  if (historyBox)
    historyBox.scrollTop = historyBox.scrollHeight;
  const footerBox = phoneDiagramBox.querySelector<HTMLElement>('#phoneFooter');
  if (footerBox)
    footerBox.scrollTop = footerBox.scrollHeight;
  const hasClickedNode = state.phoneClickedNodeId !== null;
  if (hasClickedNode) {
    const isClickRecent = Date.now() - state.phoneClickedAtMs < PHONE_CLICKED_BORDER_MS;
    if (isClickRecent) {
      const clickedEl = phoneDiagramBox.querySelector(`[data-node-id="${state.phoneClickedNodeId}"]`);
      if (clickedEl)
        clickedEl.classList.add('phone-clicked');
    }
  }
}
