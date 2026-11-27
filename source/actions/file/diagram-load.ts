import { codeBox, statusBox } from '../../app/dom.ts';
import { phonePath, state } from '../../app/state.ts';
import { selectEditorNode } from '../edit/editor-actions.ts';
import type { EditorGraph } from '../../model/editor-types.ts';
import { getEditorGraph } from '../../model/editor-graph.ts';
import { applyTypeMetadata, buildSourceInCurrentFileFormat, splitEditorMetadata } from '../../model/editor-metadata.ts';
import { render } from '../../views/main-diagram/render.ts';
import { applyMainZoom } from '../../views/main-diagram/zoom.ts';
import { applyMainViewport, loadList, resetEditorHistory } from '../../views/header-bar/diagram-io.ts';
import { createDiagramWatcher, setLastSavedDiagramText } from './diagram-save.ts';

export async function loadDiagram(name: string) {
  const diagramResponse = await fetch('/api/diagrams/' + encodeURIComponent(name));
  // First, so a file that cannot be read throws before the save target changes.
  const text = buildSourceInCurrentFileFormat(await diagramResponse.text());
  if (state.watcher) {
    state.watcher.close();
    state.watcher = null;
  }
  state.loadedPath = diagramResponse.headers.get('X-Diagram-Path');
  setLastSavedDiagramText(text);
  const { metadata } = splitEditorMetadata(text);
  applyTypeMetadata(metadata);
  state.currentName = name;
  // sessionStorage.setItem('loadedDiagram', name);
  sessionStorage.setItem('tabOpenedFile', JSON.stringify({ name }));
  state.openedFileHandle = null;
  statusBox.textContent = state.loadedPath ?? '';
  phonePath.length = 0;
  state.pathView = null;
  codeBox.readOnly = false;
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  state.phoneStartNodeId = null;
  state.diagramScale = null;
  state.currentDecisionId = metadata?.lastSelectedNodeId ?? null;
  state.mainZoomPercent = metadata?.mainZoomPercent ?? 100;
  codeBox.value = text;
  resetEditorHistory(text);
  await render();
  applyMainZoom(false);
  let graph: EditorGraph | null = null;
  try {
    graph = getEditorGraph();
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
  // await rewriteDecisionsAsHexagons();
}
