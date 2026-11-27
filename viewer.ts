import { codeBox } from './dom.ts';
import { getNodeId } from './render-helpers.ts';
import { selectEditorNode } from './source/actions/edit/editor-actions.ts';
import { addQuestionAfter, addBlockAfter, addChoice } from './source/actions/edit/editor-add.ts';
import { insertStaticBefore, insertDecisionBefore } from './source/actions/edit/editor-insert-before.ts';
import { removeBlock, removeChoice, removeChoices } from './source/actions/edit/editor-remove.ts';
import { removeQuestion } from './source/actions/edit/editor-remove-question.ts';
import { applyEditorRedo, applyEditorUndo } from './source/actions/edit/editor-history.ts';
import { applyMainZoom } from './zoom.ts';
import { loadDiagram } from './source/actions/file/diagram-load.ts';
import { render } from './render.ts';
import { showOpenedFile } from './source/actions/file/open-file.ts';
import { listAllPathIds } from './source/actions/file/path-export-all.ts';
import { setNodeSize } from './source/actions/edit/editor-node-size.ts';
import { findRouteIdsToNode } from './source/model/phone-render.ts';
import './source/actions/edit/editor-events.ts';
import './main-events.ts';
import './source/actions/edit/node-resize.ts';
import './viewport-menu.ts';
import './source/actions/navigation/path-view.ts';

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
