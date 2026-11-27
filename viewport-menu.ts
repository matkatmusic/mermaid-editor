import { addDecisionBlockMenuBtn, addStaticBlockMenuBtn, outputBox, viewportMenu } from './dom.ts';
import { appendEditorAction } from './editor-actions.ts';
import { addStandaloneDecisionBlock, addStandaloneStaticBlock } from './editor-add-standalone.ts';
import { refuseEditInPathView } from './path-view.ts';

function openViewportMenu(event: MouseEvent) {
  event.preventDefault();
  if (refuseEditInPathView('addStandaloneBlock', null))
    return;
  viewportMenu.style.left = event.clientX + 'px';
  viewportMenu.style.top = event.clientY + 'px';
  viewportMenu.hidden = false;
}

function closeViewportMenu() {
  viewportMenu.hidden = true;
}

function closeViewportMenuOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape')
    closeViewportMenu();
}

function addDecisionBlockFromMenu() {
  appendEditorAction(addStandaloneDecisionBlock);
}

function addStaticBlockFromMenu() {
  appendEditorAction(addStandaloneStaticBlock);
}

outputBox.addEventListener('contextmenu', openViewportMenu);
addDecisionBlockMenuBtn.addEventListener('click', addDecisionBlockFromMenu);
addStaticBlockMenuBtn.addEventListener('click', addStaticBlockFromMenu);
document.addEventListener('click', closeViewportMenu);
document.addEventListener('keydown', closeViewportMenuOnEscape);
