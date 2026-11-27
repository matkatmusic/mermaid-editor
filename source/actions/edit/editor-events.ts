import { codeBox, diagramBox, drawer, outputBox, phoneDiagramBox } from '../../../dom.ts';
import { getNodeId } from '../../../render-helpers.ts';
import { selectEditorNode } from './editor-actions.ts';
import { getEditorGraph } from '../../model/editor-graph.ts';
import { phonePath, state } from '../../../state.ts';
import { render } from '../../../render.ts';
import { findAnswersLeadingTo, isPhoneShowingHistory, selectPhonePathToNode } from '../../model/phone-render.ts';
import { parseEdges } from '../../model/diagram-source.ts';
import { parentOf } from '../../model/graph-slice.ts';
import { writeChosenPath } from '../../model/path-export.ts';
import { measureSourceLines } from '../../../source-lines.ts';
import { saveEditorViewState } from '../file/editor-view-state.ts';
import { connectNodesWithShiftClick } from './editor-connect.ts';
import { toggleNodeInSelection } from './editor-multiselect.ts';
import { refuseMoveWhileNodeNameIsInvalid } from './editor-rename.ts';
import './editor-keys.ts';
import './editor-inspector-events.ts';
import './editor-class-events.ts';
import './editor-classes-dialog.ts';
// import { filterDownstreamView } from './path-view.ts';
import { filterDownstreamView, handlePhoneTapInPathView, isNodeDrawn } from '../../../path-view.ts';

function setCodeBoxScrollToLine(lineNum: number) {
  const { tops } = measureSourceLines();
  codeBox.scrollTop = tops[lineNum] - parseFloat(getComputedStyle(codeBox).paddingTop);
}

function selectNodeSourceLine(id: string) {
  const lines = codeBox.value.split('\n');
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const startsWithId = trimmed.startsWith(id);
    const isNodeDefinition = startsWithId && ['[', '{', '('].includes(trimmed.charAt(id.length));
    if (isNodeDefinition) {
      // if (!drawer.classList.contains('closed')) {
      //   const fullText = codeBox.value;
      //   codeBox.value = fullText.slice(0, start + lines[i].length);
      //   codeBox.scrollTop = codeBox.scrollHeight;
      //   codeBox.value = fullText;
      // }
      const isDrawerOpen = !drawer.classList.contains('closed');
      if (isDrawerOpen)
        setCodeBoxScrollToLine(i);
      codeBox.focus({ preventScroll: true });
      codeBox.setSelectionRange(start, start + lines[i].length);
      codeBox.blur();
      return;
    }
    start += lines[i].length + 1;
  }
}

const selectClickedNode = (event: MouseEvent) => {
  if (refuseMoveWhileNodeNameIsInvalid())
    return;
  const nodeEl = (event.target as HTMLElement).closest('g.node');
  const id = nodeEl ? getNodeId(nodeEl) : null;
  if (event.shiftKey) {
    if (id) {
      connectNodesWithShiftClick(id);
      return;
    }
  }
  if (event.metaKey) {
    if (id) {
      toggleNodeInSelection(id);
      return;
    }
  }
  // state.connectFromNodeId = null;
  if (id)
    selectNodeSourceLine(id);
  selectEditorNode(id);
  saveEditorViewState();
  if (id) {
    // In the downstream view a plain click filters; shift-click and command-click returned above.
    if (state.pathView?.kind === 'downstream') {
      filterDownstreamView(id);
      return;
    }
    // selectPhonePathToNode(id, parseEdges(codeBox.value), getEditorGraph());
    // A view sets the phone path itself in render().
    if (!state.pathView)
      selectPhonePathToNode(id, parseEdges(codeBox.value), getEditorGraph());
    render();
  }
};
outputBox.addEventListener('click', selectClickedNode);

// A Shift mouse-down makes the browser extend the text selection from the Editor drawer to the click.
outputBox.addEventListener('mousedown', (event) => {
  if (event.shiftKey)
    event.preventDefault();
});

const selectPhoneChoice = async (event: MouseEvent) => {
  // A phone choice also selects and scrolls the main view to the next open decision.
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-choose], button[data-revert], button[data-undo], button[data-reset-decisions], button[data-write-path]');
  if (!target)
    return;
  const isWritePath = target.dataset.writePath !== undefined;
  if (isWritePath) {
    await writeChosenPath();
    return;
  }
  if (state.pathView) {
    const isHandled = await handlePhoneTapInPathView(target);
    if (isHandled)
      return;
  }
  const isResetDecisions = target.dataset.resetDecisions !== undefined;
  if (isResetDecisions) {
    document.getElementById('resetBtn')!.click();
    return;
  }
  const isUndo = target.dataset.undo !== undefined;
  if (isUndo) {
    phonePath.pop();
  }
  else if (target.dataset.choose) {
    const choiceId = target.dataset.choose;
    // A main-view jump shows a decision off the phone's path; rebuild the path so the history walk reaches it.
    const isShowingHistory = isPhoneShowingHistory();
    if (!isShowingHistory) {
      const edges = parseEdges(codeBox.value);
      const answers = findAnswersLeadingTo(parentOf(choiceId, edges), edges, getEditorGraph());
      phonePath.length = 0;
      phonePath.push(...answers);
    }
    phonePath.push(choiceId);
  }
  else {
    const [indexStr, choiceId] = target.dataset.revert!.split(':');
    phonePath.length = Number(indexStr);
    phonePath.push(choiceId);
  }
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  await render();
  // if (state.currentBottomQ) {
  // A view can leave the open decision out of the main view.
  if (state.currentBottomQ && isNodeDrawn(state.currentBottomQ)) {
    state.currentDecisionId = state.currentBottomQ;
    selectEditorNode(state.currentBottomQ);
    // centerNodeInViewport(outputBox, diagramBox, state.currentBottomQ);
    const node = diagramBox.querySelector('[id*="flowchart-' + state.currentBottomQ + '-"]')!;
    const outputRect = outputBox.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    outputBox.scrollBy({
      left: nodeRect.left + nodeRect.width / 2 - outputRect.left - outputBox.clientWidth / 2,
      top: nodeRect.top + nodeRect.height / 2 - outputRect.top - outputBox.clientHeight / 2,
      behavior: 'smooth',
    });
  }
};
phoneDiagramBox.addEventListener('click', selectPhoneChoice);

const scrollMainViewToPhoneRow = (event: MouseEvent) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>('.phone-block, .phone-question, .phone-choice-chosen');
  if (!row)
    return;
  if (!isNodeDrawn(row.dataset.nodeId!))
    return;
  if (refuseMoveWhileNodeNameIsInvalid())
    return;
  selectNodeSourceLine(row.dataset.nodeId!);
  selectEditorNode(row.dataset.nodeId!);
  saveEditorViewState();
  const node = diagramBox.querySelector('[id*="flowchart-' + row.dataset.nodeId + '-"]')!;
  const outputRect = outputBox.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  outputBox.scrollBy({
    left: nodeRect.left + nodeRect.width / 2 - outputRect.left - outputBox.clientWidth / 2,
    top: nodeRect.top + nodeRect.height / 2 - outputRect.top - outputBox.clientHeight / 2,
    behavior: 'smooth',
  });
};
phoneDiagramBox.addEventListener('click', scrollMainViewToPhoneRow);
