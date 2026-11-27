import type { EditorGraph } from '../../model/editor-types.ts';
import { parseEditorGraph } from '../../model/editor-graph-parse.ts';
import { codeBox, diagramBox, drawer, drawerToggle, outputBox, searchClearBtn, searchCounter, searchInput, searchNextBtn, searchPreviousBtn } from '../../app/dom.ts';
import { selectEditorNode } from '../edit/editor-actions.ts';
import { render } from '../../views/main-diagram/render.ts';
import { moveNodeToViewportCenter } from './decision-nav.ts';
import { measureSourceLines } from '../../views/editor-drawer/source-lines.ts';
import { parsePropsLine } from '../../model/node-props.ts';
import { isNodeDrawn } from './path-view.ts';

type SearchMatch = { start: number; end: number };

let searchMatches: SearchMatch[] = [];
let searchIndex = 0;
let searchRunId = 0;

// Retired: the search is now a plain text search of the source editor, so a parse error cannot break it.
// function findMatchingNodes(graph: EditorGraph, query: string) {
//   const matches: EditorNode[] = [];
//   if (query === '')
//     return matches;
//   const needle = query.toLowerCase();
//   for (const node of graph.nodes.values()) {
//     const idMatches = node.id.toLowerCase().includes(needle);
//     const labelMatches = node.label.toLowerCase().includes(needle);
//     const isMatch = idMatches || labelMatches;
//     if (isMatch)
//       matches.push(node);
//   }
//   matches.sort(compareNodesByLine);
//   return matches;
// }

function findSourceMatches(query: string) {
  const matches: SearchMatch[] = [];
  if (query === '')
    return matches;
  const needle = query.toLowerCase();
  const haystack = codeBox.value.toLowerCase();
  let start = haystack.indexOf(needle);
  while (start !== -1) {
    matches.push({ start, end: start + needle.length });
    start = haystack.indexOf(needle, start + needle.length);
  }
  return matches;
}

// Each node part of a line is the text between two arrows, from the node name to the end of its text.
function findNodeIdAtMatch(graph: EditorGraph, match: SearchMatch) {
  const source = codeBox.value;
  const lineStart = source.lastIndexOf('\n', match.start - 1) + 1;
  const newlineAfter = source.indexOf('\n', match.start);
  const lineEnd = newlineAfter === -1 ? source.length : newlineAfter;
  const line = source.slice(lineStart, lineEnd);
  const matchOffset = match.start - lineStart;
  const propsLine = parsePropsLine(line);
  if (propsLine) {
    const isNode = graph.nodes.has(propsLine.blockId);
    if (isNode)
      return propsLine.blockId;
  }
  const parts: { id: string; start: number; end: number }[] = [];
  let partStart = 0;
  const arrows = [...line.matchAll(/-->|---|==>|-\.->/g)];
  const partEnds = [...arrows.map((arrow) => arrow.index!), line.length];
  for (let i = 0; i < partEnds.length; i++) {
    const partText = line.slice(partStart, partEnds[i]);
    const idMatch = partText.match(/^\s*(?:\|[^|]*\|)?\s*([A-Za-z_][A-Za-z0-9_]*)/);
    if (idMatch) {
      const isNode = graph.nodes.has(idMatch[1]);
      if (isNode)
        parts.push({ id: idMatch[1], start: partStart, end: partEnds[i] });
    }
    if (i < arrows.length)
      partStart = arrows[i].index! + arrows[i][0].length;
  }
  for (const part of parts) {
    const isMatchInsidePart = matchOffset >= part.start && matchOffset < part.end;
    if (isMatchInsidePart)
      return part.id;
  }
  return parts[0]?.id;
}

function updateSearchControls() {
  const hasText = searchInput.value !== '';
  const hasSeveralMatches = searchMatches.length > 1;
  const current = searchMatches.length === 0 ? 0 : searchIndex + 1;
  searchClearBtn.hidden = !hasText;
  searchCounter.hidden = !hasText;
  searchPreviousBtn.hidden = !hasSeveralMatches;
  searchNextBtn.hidden = !hasSeveralMatches;
  searchCounter.textContent = `${current} / ${searchMatches.length}`;
}

function showMatchInSourceEditor(match: SearchMatch) {
  const isDrawerClosed = drawer.classList.contains('closed');
  if (isDrawerClosed)
    drawerToggle.click();
  // setSelectionRange on an unfocused textarea keeps the cursor in the Search box.
  codeBox.setSelectionRange(match.start, match.end);
  const lineIndex = codeBox.value.slice(0, match.start).split('\n').length - 1;
  const { tops } = measureSourceLines();
  codeBox.scrollTop = tops[lineIndex] - parseFloat(getComputedStyle(codeBox).paddingTop);
}

// The first match at or after the index, in the step's direction, whose block is on screen.
// A match that names no block counts. undefined means every match is in a hidden block.
function findShownMatchIndex(fromIndex: number, step: 1 | -1) {
  const { graph, problems } = parseEditorGraph(codeBox.value);
  for (let offset = 0; offset < searchMatches.length; offset++) {
    const unwrapped = fromIndex + offset * step;
    const index = ((unwrapped % searchMatches.length) + searchMatches.length) % searchMatches.length;
    if (problems.length)
      return index;
    const id = findNodeIdAtMatch(graph, searchMatches[index]);
    if (!id)
      return index;
    if (isNodeDrawn(id))
      return index;
  }
  return undefined;
}

async function moveToSearchMatch() {
  const runId = ++searchRunId;
  const match = searchMatches[searchIndex];
  showMatchInSourceEditor(match);
  const { graph, problems } = parseEditorGraph(codeBox.value);
  const hasParseError = problems.length > 0;
  if (hasParseError)
    return;
  const id = findNodeIdAtMatch(graph, match);
  if (!id)
    return;
  selectEditorNode(id);
  await render();
  // A newer keypress or cycle click started its own jump while this render awaited; that one wins.
  if (runId !== searchRunId)
    return;
  selectEditorNode(id);
  moveNodeToViewportCenter(outputBox, diagramBox, id);
}

export async function executeSearch() {
  searchMatches = findSourceMatches(searchInput.value);
  searchIndex = 0;
  updateSearchControls();
  if (searchMatches.length === 0)
    return;
  // await moveToSearchMatch();
  const shownIndex = findShownMatchIndex(0, 1);
  if (shownIndex === undefined)
    return;
  searchIndex = shownIndex;
  updateSearchControls();
  await moveToSearchMatch();
}

export function refreshSearchMatches() {
  searchMatches = findSourceMatches(searchInput.value);
  searchIndex = Math.min(searchIndex, Math.max(searchMatches.length - 1, 0));
  updateSearchControls();
}

export async function moveSearchSelection(step: 1 | -1) {
  // searchIndex = (searchIndex + step + searchMatches.length) % searchMatches.length;
  // updateSearchControls();
  // await moveToSearchMatch();
  const shownIndex = findShownMatchIndex(searchIndex + step, step);
  if (shownIndex === undefined)
    return;
  searchIndex = shownIndex;
  updateSearchControls();
  await moveToSearchMatch();
}

export function clearSearch() {
  searchInput.value = '';
  searchMatches = [];
  searchIndex = 0;
  searchRunId++;
  updateSearchControls();
}
