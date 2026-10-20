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
import { listAllPathIds } from './path-export-all.ts';
import './editor-events.ts';
import './main-events.ts';

// render();
// loadList();
applyMainZoom(false);
loadDiagram(sessionStorage.getItem('loadedDiagram') ?? 'accountability.mmd');

Object.assign(window, { loadDiagram, codeBox, getNodeId, selectEditorNode, addQuestionAfter, addBlockAfter, removeQuestion, removeBlock, addChoice, removeChoice, removeChoices, applyEditorUndo, applyEditorRedo, insertStaticBefore, insertDecisionBefore, listAllPathIds });
