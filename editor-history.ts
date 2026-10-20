import { state } from './state.ts';
import { applyEditorSource, executeEditorAction, selectEditorNode } from './editor-actions.ts';

function applyHistoryEntry() {
  return applyEditorSource(state.editorHistory[state.editorHistoryIndex], { recordHistory: false });
}

export function applyEditorUndo() {
  if (state.editorHistoryIndex <= 0)
    return;
  state.editorHistoryIndex--;
  // Clear selection before committing so the re-stamped metadata doesn't leak the current selection into the restored history entry.
  selectEditorNode(null);
  executeEditorAction(applyHistoryEntry);
}

export function applyEditorRedo() {
  if (state.editorHistoryIndex >= state.editorHistory.length - 1)
    return;
  state.editorHistoryIndex++;
  // Clear selection before committing so the re-stamped metadata doesn't leak the current selection into the restored history entry.
  selectEditorNode(null);
  executeEditorAction(applyHistoryEntry);
}
