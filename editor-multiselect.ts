import { state } from './state.ts';
import { renderEditorSelection, selectEditorNode } from './editor-actions.ts';

export function getSelectedNodeIds(): string[] {
  if (state.multiSelectedNodeIds.length)
    return state.multiSelectedNodeIds;
  if (state.selectedEditorNodeId)
    return [state.selectedEditorNodeId];
  return [];
}

export function toggleNodeInSelection(id: string) {
  const currentIds = getSelectedNodeIds();
  const nextIds = currentIds.includes(id) ? currentIds.filter((currentId) => currentId !== id) : [...currentIds, id];
  if (nextIds.length <= 1) {
    selectEditorNode(nextIds[0] ?? null);
    return;
  }
  selectEditorNode(null);
  state.multiSelectedNodeIds = nextIds;
  renderEditorSelection();
}
