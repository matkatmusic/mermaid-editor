import type { EditorGraph, EditorNode } from './editor-types.ts';
import { editorGraph } from './editor-graph.ts';
import { diagramBox, outputBox, searchClearBtn, searchCounter, searchInput, searchNextBtn, searchPreviousBtn } from './dom.ts';
import { showEditorValidationError } from './render-helpers.ts';
import { selectEditorNode } from './editor-actions.ts';
import { render } from './render.ts';
import { centerNodeInViewport } from './decision-nav.ts';

let searchMatches: EditorNode[] = [];
let searchIndex = 0;
let searchRunId = 0;

function matchingNodes(graph: EditorGraph, query: string) {
  if (query === '')
    return [];
  const needle = query.toLowerCase();
  return [...graph.nodes.values()]
    .filter(node => node.id.toLowerCase().includes(needle) || node.label.toLowerCase().includes(needle))
    .sort((a, b) => a.lineIndex - b.lineIndex);
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

async function jumpToSearchMatch() {
  const runId = ++searchRunId;
  const id = searchMatches[searchIndex].id;
  selectEditorNode(id);
  await render();
  // A newer keypress or cycle click started its own jump while this render awaited; that one wins.
  if (runId !== searchRunId)
    return;
  selectEditorNode(id);
  centerNodeInViewport(outputBox, diagramBox, id);
}

export async function runSearch() {
  let graph: EditorGraph;
  try {
    graph = editorGraph();
  }
  catch (error) {
    showEditorValidationError(error);
    return;
  }
  searchMatches = matchingNodes(graph, searchInput.value);
  searchIndex = 0;
  updateSearchControls();
  if (searchMatches.length === 0)
    return;
  await jumpToSearchMatch();
}

export async function cycleSearch(step: 1 | -1) {
  searchIndex = (searchIndex + step + searchMatches.length) % searchMatches.length;
  updateSearchControls();
  await jumpToSearchMatch();
}

export function clearSearch() {
  searchInput.value = '';
  searchMatches = [];
  searchIndex = 0;
  searchRunId++;
  updateSearchControls();
}
