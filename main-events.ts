import { MAIN_ZOOM_STEP, chosenAnswers, phonePath, state } from './state.ts';
import { applyTypeMetadata } from './source/model/editor-metadata.ts';
import { codeBox, drawer, drawerToggle, nextDecisionBtn, openFileBtn, outputBox, phoneDiagramBox, previousDecisionBtn, searchClearBtn, searchInput, searchNextBtn, searchPreviousBtn, selectBox, statusBox, zoomInBtn, zoomOutBtn, zoomResetBtn } from './dom.ts';
import { applyMainViewport, loadList, resetEditorHistory, setDrawerOpen } from './source/views/header-bar/diagram-io.ts';
import { getEditorGraph } from './source/model/editor-graph.ts';
import { loadDiagram } from './source/actions/file/diagram-load.ts';
import { saveDiagram } from './source/actions/file/diagram-save.ts';
import { openFileFromDialog } from './source/actions/file/open-file.ts';
import { render } from './source/views/main-diagram/render.ts';
import { moveToDecision } from './source/actions/navigation/decision-nav.ts';
import { clearSearch, executeSearch, moveSearchSelection } from './source/actions/navigation/node-search.ts';
import { setMainZoomPercent } from './source/views/main-diagram/zoom.ts';
import { applyPathHighlight } from './source/views/main-diagram/render-helpers.ts';

// The classes every new document starts with.
const DEFAULT_CLASS_LINES = [
  '  classDef information fill:#ffffff,stroke:#000000',
  '  classDef Decision fill:#ffff00,stroke:#000000',
  '  classDef Yes-path fill:#00ff00,stroke:#000000',
  '  classDef No-path fill:#ff0000,stroke:#000000',
  '  classDef Checkpoint fill:#ff8000,stroke:#000000',
  '  classDef Action fill:#fc00ff,stroke:#000000',
  '  classDef Question fill:#79d4fb,stroke:#000000',
  '  classDef Answer fill:#5df9b5,stroke:#000000',
];

async function resetEditorToNewDiagram() {
  if (state.watcher) {
    state.watcher.close();
    state.watcher = null;
  }
  state.currentName = null;
  state.openedFileHandle = null;
  state.loadedPath = null;
  sessionStorage.removeItem('tabOpenedFile');
  statusBox.textContent = '';
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  state.diagramScale = null;
  state.pathView = null;
  codeBox.readOnly = false;
  state.currentDecisionId = null;
  applyTypeMetadata(null);
  // codeBox.value = 'flowchart TD\n  B_NEW[New idea]';
  codeBox.value = ['flowchart TD', '  B_NEW[New idea]', ...DEFAULT_CLASS_LINES].join('\n');
  resetEditorHistory(codeBox.value);
  await render();
  applyMainViewport(null, getEditorGraph());
  loadList();
  setDrawerOpen(true);
}
function selectPreviousDecision() {
  moveToDecision(-1);
}
function selectNextDecision() {
  moveToDecision(1);
}
function selectPreviousSearchMatch() {
  moveSearchSelection(-1);
}
function selectNextSearchMatch() {
  moveSearchSelection(1);
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
  state.phoneStartNodeId = null;
  applyPathHighlight();
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
searchInput.addEventListener('input', executeSearch);
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
