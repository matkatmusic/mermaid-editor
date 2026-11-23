import { state } from './state.ts';
import { getEditorGraph } from './editor-graph.ts';
import { setEditorActionPromise } from './editor-metadata.ts';
import { buildSourceWithLinesReplaced } from './source-edit.ts';
import { applyEditorSource, selectEditorNode } from './editor-actions.ts';

export function connectNodesWithShiftClick(clickedId: string) {
  const fromId = state.selectedEditorNodeId;
  if (!fromId) {
    selectEditorNode(clickedId);
    return;
  }
  if (fromId === clickedId)
    return;
  // state.connectFromNodeId = null;
  const graph = getEditorGraph();
  const newLines = [`  ${fromId} --> ${clickedId}`];
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, new Set<number>(), newLines)));
}
