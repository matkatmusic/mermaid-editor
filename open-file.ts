import { state } from './state.ts';
import { restoreTypeMetadata, splitEditorMetadata } from './editor-graph.ts';
import { codeBox, selectBox, statusBox } from './dom.ts';
import { loadList, resetEditorHistory, setDrawerOpen } from './diagram-io.ts';
import { render } from './render.ts';

// The server opens the macOS file dialog so the full path is known; File -> Save writes back to that path.
export async function openFileFromDialog() {
  // let fileHandles;
  // try {
  //   fileHandles = await (window as any).showOpenFilePicker({ types: MMD_FILE_TYPES });
  // }
  // catch (error) {
  //   const isUserCancel = (error as DOMException).name === 'AbortError';
  //   if (!isUserCancel)
  //     throw error;
  //   console.log('User canceled Open File');
  //   return;
  // }
  // const [fileHandle] = fileHandles;
  // const file = await fileHandle.getFile();
  const openResponse = await fetch('/api/open-file');
  if (openResponse.status === 204) {
    console.log('User canceled Open File');
    return;
  }
  const { path, text } = await openResponse.json();
  if (state.watcher)
    state.watcher.close();
  state.currentName = null;
  // state.openedFileHandle = fileHandle;
  state.openedFileHandle = null;
  state.loadedPath = path;
  statusBox.textContent = path;
  state.pathFolderHandle = null;
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  state.diagramScale = null;
  state.currentDecisionId = null;
  // codeBox.value = await file.text();
  codeBox.value = text;
  restoreTypeMetadata(splitEditorMetadata(codeBox.value).metadata);
  resetEditorHistory(codeBox.value);
  selectBox.value = '';
  render();
  loadList();
  setDrawerOpen(true);
}
