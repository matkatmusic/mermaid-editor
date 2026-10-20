import { codeBox } from './dom.ts';
import { state } from './state.ts';
import { restoreTypeMetadata, splitEditorMetadata } from './editor-graph.ts';
import { render } from './render.ts';
import { loadList, resetEditorHistory, setStatus } from './diagram-io.ts';

let lastSavedDiagramText: string | null = null;
let watchedDiagramName: string | null = null;
let pendingSaveCount = 0;
let saveVersion = 0;

export function setLastSavedDiagramText(text: string) {
  lastSavedDiagramText = text;
}

export function createDiagramWatcher(name: string) {
  if (state.watcher)
    state.watcher.close();
  watchedDiagramName = name;
  const source = new EventSource('/api/watch/' + encodeURIComponent(name));
  state.watcher = source;
  const refresh = async () => {
    const versionAtFetchStart = saveVersion;
    const saveInFlightAtFetchStart = pendingSaveCount > 0;
    const diagramResponse = await fetch('/api/diagrams/' + encodeURIComponent(name));
    const text = await diagramResponse.text();
    const isStaleWatcher = state.watcher !== source;
    if (isStaleWatcher)
      return;
    // The server may answer this GET from the file before that save's PUT lands, returning pre-edit text.
    if (saveInFlightAtFetchStart)
      return;
    // A save, not an external edit, triggered this notification.
    if (pendingSaveCount > 0)
      return;
    if (saveVersion !== versionAtFetchStart)
      return;
    if (text === lastSavedDiagramText)
      return;
    if (text !== codeBox.value) {
      restoreTypeMetadata(splitEditorMetadata(text).metadata);
      codeBox.value = text;
      resetEditorHistory(text);
    }
    render();
  };
  source.onmessage = refresh;
  source.onopen = refresh;
}

export const MMD_FILE_TYPES = [{ description: 'Mermaid diagram', accept: { 'text/plain': ['.mmd'] } }];

export async function saveDiagram() {
  const needsSaveAsDialog = !state.currentName && !state.openedFileHandle && !state.loadedPath;
  if (needsSaveAsDialog) {
    try {
      state.openedFileHandle = await (window as any).showSaveFilePicker({ suggestedName: 'diagram.mmd', types: MMD_FILE_TYPES });
    }
    catch (error) {
      const isUserCancel = (error as DOMException).name === 'AbortError';
      if (!isUserCancel)
        throw error;
      console.log('User canceled Save');
      return;
    }
  }
  const fileHandle = state.openedFileHandle;
  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(codeBox.value);
    await writable.close();
    setStatus('Saved ' + fileHandle.name);
    return;
  }
  const hasNoName = !state.currentName;
  const hasLoadedPath = !!state.loadedPath;
  const savesToLoadedPath = hasNoName && hasLoadedPath;
  if (savesToLoadedPath) {
    const openFileResponse = await fetch('/api/open-file', { method: 'PUT', body: codeBox.value });
    if (!openFileResponse.ok)
      throw new Error(await openFileResponse.text());
    setStatus('Saved ' + state.loadedPath);
    return;
  }
  const name = state.currentName!;
  // let name = state.currentName;
  // if (!name) {
  //   name = prompt('Name this diagram (letters, numbers, - and _ only):');
  //   if (!name)
  //     return;
  //   const hasMmdExtension = name.endsWith('.mmd');
  //   if (!hasMmdExtension)
  //     name += '.mmd';
  // }
  lastSavedDiagramText = codeBox.value;
  pendingSaveCount++;
  saveVersion++;
  try {
    await fetch('/api/diagrams/' + encodeURIComponent(name), {
      method: 'PUT',
      body: codeBox.value,
    });
  }
  finally {
    pendingSaveCount--;
  }
  state.currentName = name;
  setStatus('Saved ' + name);
  loadList();
  // Don't reopen an already-watching watcher; that raced a stale onmessage against the new one.
  const hasNoWatcher = !state.watcher;
  if (hasNoWatcher) {
    createDiagramWatcher(name);
  }
  else {
    const isWatchingSomethingElse = watchedDiagramName !== name;
    if (isWatchingSomethingElse)
      createDiagramWatcher(name);
  }
}
