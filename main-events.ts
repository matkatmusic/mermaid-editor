import { MAIN_ZOOM_STEP, chosenAnswers, phonePath, state } from './state.ts';
import { restoreTypeMetadata } from './editor-graph.ts';
import { codeBox, drawer, drawerToggle, nextDecisionBtn, openFileBtn, outputBox, phoneDiagramBox, previousDecisionBtn, searchClearBtn, searchInput, searchNextBtn, searchPreviousBtn, selectBox, statusBox, zoomInBtn, zoomOutBtn, zoomResetBtn } from './dom.ts';
import { loadList, resetEditorHistory, setDrawerOpen } from './diagram-io.ts';
import { loadDiagram } from './diagram-load.ts';
import { saveDiagram } from './diagram-save.ts';
import { openFileFromDialog } from './open-file.ts';
import { render } from './render.ts';
import { navigateDecision } from './decision-nav.ts';
import { clearSearch, cycleSearch, runSearch } from './node-search.ts';
import { setMainZoomPercent } from './zoom.ts';
import { highlightPath } from './render-helpers.ts';

function resetEditorToNewDiagram() {
  if (state.watcher)
    state.watcher.close();
  state.currentName = null;
  state.openedFileHandle = null;
  state.loadedPath = null;
  statusBox.textContent = '';
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  state.diagramScale = null;
  state.currentDecisionId = null;
  restoreTypeMetadata(null);
  codeBox.value = 'flowchart TD\n  B_NEW[New idea]';
  resetEditorHistory(codeBox.value);
  render();
  loadList();
  setDrawerOpen(true);
}
function selectPreviousDecision() {
  navigateDecision(-1);
}
function selectNextDecision() {
  navigateDecision(1);
}
function selectPreviousSearchMatch() {
  cycleSearch(-1);
}
function selectNextSearchMatch() {
  cycleSearch(1);
}
function applyZoomIn() {
  setMainZoomPercent(state.mainZoomPercent + MAIN_ZOOM_STEP);
}
function applyZoomOut() {
  setMainZoomPercent(state.mainZoomPercent - MAIN_ZOOM_STEP);
}
function resetZoom() {
  setMainZoomPercent(100);
}
function resetChosenPath() {
  chosenAnswers.clear();
  phonePath.length = 0;
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  highlightPath();
  render();
  outputBox.scrollTo({ top: 0, behavior: 'smooth' });
  phoneDiagramBox.querySelector('#phoneHistory')?.scrollTo({ top: 0, behavior: 'smooth' });
}
function toggleDrawer() {
  setDrawerOpen(drawer.classList.contains('closed'));
}
function loadSelectedDiagram() {
  loadDiagram(selectBox.value);
}

function renderCodeBoxEdit() {
  resetEditorHistory(codeBox.value);
  render();
}
function closeFileMenu() {
  (document.getElementById('fileMenu') as HTMLDetailsElement).open = false;
}

document.getElementById('newBtn')!.addEventListener('click', resetEditorToNewDiagram);
document.getElementById('saveBtn')!.addEventListener('click', saveDiagram);
previousDecisionBtn.addEventListener('click', selectPreviousDecision);
nextDecisionBtn.addEventListener('click', selectNextDecision);
searchInput.addEventListener('input', runSearch);
searchClearBtn.addEventListener('click', clearSearch);
searchPreviousBtn.addEventListener('click', selectPreviousSearchMatch);
searchNextBtn.addEventListener('click', selectNextSearchMatch);
zoomInBtn.addEventListener('click', applyZoomIn);
zoomOutBtn.addEventListener('click', applyZoomOut);
zoomResetBtn.addEventListener('click', resetZoom);
document.getElementById('resetBtn')!.addEventListener('click', resetChosenPath);
drawerToggle.addEventListener('click', toggleDrawer);
selectBox.addEventListener('change', loadSelectedDiagram);
openFileBtn.addEventListener('click', openFileFromDialog);
// openFileBtn.addEventListener('click', () => openFileInput.click());
// openFileInput.addEventListener('change', async () => {
//   const file = openFileInput.files![0];
//   if (!file)
//     return;
//   if (state.watcher)
//     state.watcher.close();
//   state.currentName = null;
//   state.phoneFocusNodeId = null;
//   state.phoneFocusUsesDecisionContext = false;
//   state.phonePreviewChoiceId = null;
//   state.diagramScale = null;
//   state.currentDecisionId = null;
//   codeBox.value = await file.text();
//   restoreTypeMetadata(splitEditorMetadata(codeBox.value).metadata);
//   resetEditorHistory(codeBox.value);
//   selectBox.value = '';
//   render();
//   loadList();
//   setDrawerOpen(true);
//   openFileInput.value = '';
// });

codeBox.addEventListener('input', renderCodeBoxEdit);

document.getElementById('fileMenuItems')!.addEventListener('click', closeFileMenu);
