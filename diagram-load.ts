import { codeBox, statusBox } from './dom.ts';
import { phonePath, state } from './state.ts';
import { selectEditorNode } from './editor-actions.ts';
import type { EditorGraph } from './editor-types.ts';
import { editorGraph, restoreTypeMetadata, splitEditorMetadata } from './editor-graph.ts';
import { render } from './render.ts';
import { applyMainZoom } from './zoom.ts';
import { applyMainViewport, loadList, resetEditorHistory } from './diagram-io.ts';
import { createDiagramWatcher, setLastSavedDiagramText } from './diagram-save.ts';

export async function loadDiagram(name: string) {
  if (state.watcher) {
    state.watcher.close();
    state.watcher = null;
  }
  const diagramResponse = await fetch('/api/diagrams/' + encodeURIComponent(name));
  state.loadedPath = diagramResponse.headers.get('X-Diagram-Path');
  const text = await diagramResponse.text();
  setLastSavedDiagramText(text);
  const { metadata } = splitEditorMetadata(text);
  restoreTypeMetadata(metadata);
  state.currentName = name;
  sessionStorage.setItem('loadedDiagram', name);
  state.openedFileHandle = null;
  statusBox.textContent = state.loadedPath ?? '';
  phonePath.length = 0;
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  state.diagramScale = null;
  state.currentDecisionId = metadata?.lastSelectedNodeId ?? null;
  state.mainZoomPercent = metadata?.mainZoomPercent ?? 100;
  codeBox.value = text;
  resetEditorHistory(text);
  await render();
  applyMainZoom(false);
  let graph: EditorGraph | null = null;
  try {
    graph = editorGraph();
  }
  catch {
    // render() has already surfaced the validation failure.
  }
  if (metadata) {
    const hasSavedSelection = graph?.nodes.has(metadata.lastSelectedNodeId ?? '');
    if (hasSavedSelection)
      selectEditorNode(metadata.lastSelectedNodeId);
  }
  if (graph)
    applyMainViewport(metadata, graph);
  loadList();
  createDiagramWatcher(name);
}
