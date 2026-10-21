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
import { showOpenedFile } from './open-file.ts';
import { listAllPathIds } from './path-export-all.ts';
import './editor-events.ts';
import './main-events.ts';

// render();
// loadList();
applyMainZoom(false);
// loadDiagram(sessionStorage.getItem('loadedDiagram') ?? 'accountability.mmd');
async function loadLastOpened() {
  const response = await fetch('/api/last-opened');
  if (response.status === 204)
    return loadDiagram('accountability.mmd');
  const saved = await response.json();
  if (saved.name)
    return loadDiagram(saved.name);
  showOpenedFile(saved.path, saved.text);
}
loadLastOpened();

Object.assign(window, { loadDiagram, codeBox, getNodeId, selectEditorNode, addQuestionAfter, addBlockAfter, removeQuestion, removeBlock, addChoice, removeChoice, removeChoices, applyEditorUndo, applyEditorRedo, insertStaticBefore, insertDecisionBefore, listAllPathIds });
