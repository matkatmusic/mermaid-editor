import { codeBox } from './dom.ts';
import { getNodeId } from '../views/main-diagram/render-helpers.ts';
import { selectEditorNode } from '../actions/edit/editor-actions.ts';
import { addQuestionAfter, addBlockAfter, addChoice } from '../actions/edit/editor-add.ts';
import { insertStaticBefore, insertDecisionBefore } from '../actions/edit/editor-insert-before.ts';
import { removeBlock, removeChoice, removeChoices } from '../actions/edit/editor-remove.ts';
import { removeQuestion } from '../actions/edit/editor-remove-question.ts';
import { applyEditorRedo, applyEditorUndo } from '../actions/edit/editor-history.ts';
import { applyMainZoom } from '../views/main-diagram/zoom.ts';
import { loadDiagram } from '../actions/file/diagram-load.ts';
import { render } from '../views/main-diagram/render.ts';
import { showOpenedFile } from '../actions/file/open-file.ts';
import { listAllPathIds } from '../actions/file/path-export-all.ts';
import { setNodeSize } from '../actions/edit/editor-node-size.ts';
import { findRouteIdsToNode } from '../model/phone-render.ts';
import '../actions/edit/editor-events.ts';
import './main-events.ts';
import '../actions/edit/node-resize.ts';
import '../views/main-diagram/viewport-menu.ts';
import '../actions/navigation/path-view.ts';

// render();
// loadList();
applyMainZoom(false);
// loadDiagram(sessionStorage.getItem('loadedDiagram') ?? 'accountability.mmd');
async function loadLastOpened() {
  // A reloaded tab keeps the file it had; only a tab with no history asks the server for the last opened file.
  // const tabOpenedFile = JSON.parse(sessionStorage.getItem('tabOpenedFile') ?? 'null');
  const tabOpenedFile: { name?: string; path?: string } | null = JSON.parse(sessionStorage.getItem('tabOpenedFile') ?? 'null');
  if (tabOpenedFile?.name)
    return loadDiagram(tabOpenedFile.name);
  if (tabOpenedFile?.path) {
    const tabFileResponse = await fetch('/api/opened-file?path=' + encodeURIComponent(tabOpenedFile.path));
    if (tabFileResponse.ok)
      return showOpenedFile(tabOpenedFile.path, await tabFileResponse.text());
  }
  const response = await fetch('/api/last-opened');
  if (response.status === 204)
    return loadDiagram('accountability.mmd');
  // const saved = await response.json();
  const saved: { name?: string; path: string; text: string } = await response.json();
  if (saved.name)
    return loadDiagram(saved.name);
  showOpenedFile(saved.path, saved.text);
}
loadLastOpened();

Object.assign(window, { render, loadDiagram, showOpenedFile, codeBox, getNodeId, selectEditorNode, addQuestionAfter, addBlockAfter, removeQuestion, removeBlock, addChoice, removeChoice, removeChoices, applyEditorUndo, applyEditorRedo, insertStaticBefore, insertDecisionBefore, listAllPathIds, setNodeSize, findRouteIdsToNode });
