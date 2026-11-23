import { codeBox } from './dom.ts';
import { getNodeId } from './render-helpers.ts';
import { selectEditorNode } from './editor-actions.ts';
import { addQuestionAfter, addBlockAfter, addChoice } from './editor-add.ts';
import { insertStaticBefore, insertDecisionBefore } from './editor-insert-before.ts';
import { removeBlock, removeChoice, removeChoices } from './editor-remove.ts';
import { removeQuestion } from './editor-remove-question.ts';
import { applyEditorRedo, applyEditorUndo } from './editor-history.ts';
import { applyMainZoom } from './zoom.ts';
import { loadDiagram } from './diagram-load.ts';
import { render } from './render.ts';
import { showOpenedFile } from './open-file.ts';
import { listAllPathIds } from './path-export-all.ts';
import { setNodeSize } from './editor-node-size.ts';
import './editor-events.ts';
import './main-events.ts';
import './node-resize.ts';
import './viewport-menu.ts';

// render();
// loadList();
applyMainZoom(false);
// loadDiagram(sessionStorage.getItem('loadedDiagram') ?? 'accountability.mmd');
async function loadLastOpened() {
  // A reloaded tab keeps the file it had; only a tab with no history asks the server for the last opened file.
  const tabOpenedFile = JSON.parse(sessionStorage.getItem('tabOpenedFile') ?? 'null');
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
  const saved = await response.json();
  if (saved.name)
    return loadDiagram(saved.name);
  showOpenedFile(saved.path, saved.text);
}
loadLastOpened();

Object.assign(window, { render, loadDiagram, showOpenedFile, codeBox, getNodeId, selectEditorNode, addQuestionAfter, addBlockAfter, removeQuestion, removeBlock, addChoice, removeChoice, removeChoices, applyEditorUndo, applyEditorRedo, insertStaticBefore, insertDecisionBefore, listAllPathIds, setNodeSize });
