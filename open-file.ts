import { state } from './state.ts';
import { applyTypeMetadata, buildSourceInCurrentFileFormat, splitEditorMetadata } from './editor-metadata.ts';
import { codeBox, selectBox, statusBox } from './dom.ts';
import { applyMainViewport, loadList, resetEditorHistory, setDrawerOpen } from './diagram-io.ts';
import { render } from './render.ts';
import { selectEditorNode } from './editor-actions.ts';
import { getEditorGraph } from './editor-graph.ts';
import { applyMainZoom } from './zoom.ts';
import { createDiagramWatcher, setLastSavedDiagramText } from './diagram-save.ts';

// The server opens the macOS file dialog, so the full path is known.
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
  showOpenedFile(path, text);
}

export async function showOpenedFile(path: string, text: string) {
  // First, so a file that cannot be read throws before the save target changes.
  text = buildSourceInCurrentFileFormat(text);
  if (state.watcher) {
    state.watcher.close();
    state.watcher = null;
  }
  state.currentName = null;
  // state.openedFileHandle = fileHandle;
  state.openedFileHandle = null;
  state.loadedPath = path;
  statusBox.textContent = path;
  state.pathFolderHandle = null;
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  state.phoneStartNodeId = null;
  state.diagramScale = null;
  const { metadata } = splitEditorMetadata(text);
  state.currentDecisionId = metadata?.lastSelectedNodeId ?? null;
  state.mainZoomPercent = metadata?.mainZoomPercent ?? 100;
  // codeBox.value = await file.text();
  codeBox.value = text;
  applyTypeMetadata(metadata);
  resetEditorHistory(codeBox.value);
  selectBox.value = '';
  await render();
  applyMainZoom(false);
  loadList();
  setDrawerOpen(true);
  setLastSavedDiagramText(text);
  sessionStorage.setItem('tabOpenedFile', JSON.stringify({ path }));
  createDiagramWatcher(path, '/api/watch-opened?path=' + encodeURIComponent(path), '/api/opened-file?path=' + encodeURIComponent(path));
  const graph = getEditorGraph();
  if (graph.nodes.has(metadata?.lastSelectedNodeId ?? ''))
    selectEditorNode(metadata!.lastSelectedNodeId);
  applyMainViewport(metadata, graph);
  // await rewriteDecisionsAsHexagons();
}
