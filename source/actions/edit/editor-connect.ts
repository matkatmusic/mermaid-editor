import { state } from '../../app/state.ts';
import { getEditorGraph } from '../../model/editor-graph.ts';
import { setEditorActionPromise } from '../../model/editor-metadata.ts';
import { buildSourceWithLinesReplaced } from '../../model/source-edit.ts';
import { applyEditorSource, selectEditorNode } from './editor-actions.ts';
import { refuseEditInPathView } from '../navigation/path-view.ts';

export function connectNodesWithShiftClick(clickedId: string) {
  // A view blocks both shift-clicks, also the first one that only selects.
  if (refuseEditInPathView('connectNodes', null))
    return;
  const fromId = state.selectedEditorNodeId;
  if (!fromId) {
    selectEditorNode(clickedId);
    return;
  }
  if (fromId === clickedId)
    return;
  // if (refuseEditInPathView('connectNodes', null))
  //   return;
  // state.connectFromNodeId = null;
  const graph = getEditorGraph();
  const newLines = [`  ${fromId} --> ${clickedId}`];
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, new Set<number>(), newLines)));
}
