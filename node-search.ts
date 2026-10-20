import type { EditorGraph, EditorNode } from './editor-types.ts';
import { getEditorGraph } from './editor-graph.ts';
import { diagramBox, outputBox, searchClearBtn, searchCounter, searchInput, searchNextBtn, searchPreviousBtn } from './dom.ts';
import { reportEditorValidationError } from './render-helpers.ts';
import { selectEditorNode } from './editor-actions.ts';
import { render } from './render.ts';
import { moveNodeToViewportCenter } from './decision-nav.ts';

let searchMatches: EditorNode[] = [];
let searchIndex = 0;
let searchRunId = 0;

function compareNodesByLine(a: EditorNode, b: EditorNode) {
  return a.lineIndex - b.lineIndex;
}

function findMatchingNodes(graph: EditorGraph, query: string) {
  const matches: EditorNode[] = [];
  if (query === '')
    return matches;
  const needle = query.toLowerCase();
  for (const node of graph.nodes.values()) {
    const idMatches = node.id.toLowerCase().includes(needle);
    const labelMatches = node.label.toLowerCase().includes(needle);
    const isMatch = idMatches || labelMatches;
    if (isMatch)
      matches.push(node);
  }
  matches.sort(compareNodesByLine);
  return matches;
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

async function moveToSearchMatch() {
  const runId = ++searchRunId;
  const id = searchMatches[searchIndex].id;
  selectEditorNode(id);
  await render();
  // A newer keypress or cycle click started its own jump while this render awaited; that one wins.
  if (runId !== searchRunId)
    return;
  selectEditorNode(id);
  moveNodeToViewportCenter(outputBox, diagramBox, id);
}

export async function executeSearch() {
  let graph: EditorGraph;
  try {
    graph = getEditorGraph();
  }
  catch (error) {
    reportEditorValidationError(error);
    return;
  }
  searchMatches = findMatchingNodes(graph, searchInput.value);
  searchIndex = 0;
  updateSearchControls();
  if (searchMatches.length === 0)
    return;
  await moveToSearchMatch();
}

export async function moveSearchSelection(step: 1 | -1) {
  searchIndex = (searchIndex + step + searchMatches.length) % searchMatches.length;
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
