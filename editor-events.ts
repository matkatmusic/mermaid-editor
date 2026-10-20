import { codeBox, diagramBox, drawer, outputBox, phoneDiagramBox } from './dom.ts';
import { getNodeId } from './render-helpers.ts';
import { selectEditorNode } from './editor-actions.ts';
import { getEditorGraph } from './editor-graph.ts';
import { phonePath, state } from './state.ts';
import { render } from './render.ts';
import { findNearestFeedingChoice } from './decision-search.ts';
import { findAnswersLeadingTo, isPhoneShowingHistory } from './phone-render.ts';
import { parseEdges } from './diagram-source.ts';
import { parentOf } from './graph-slice.ts';
import { writeChosenPath } from './path-export.ts';
import './editor-inspector-events.ts';
import './editor-class-events.ts';
import './editor-classes-dialog.ts';

function setCodeBoxScrollToLine(lineNum: number) {
  const style = getComputedStyle(codeBox);
  const mirror = document.createElement('div');
  mirror.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;width:${codeBox.clientWidth}px;padding:${style.padding};font:${style.font};line-height:${style.lineHeight};`;
  const allLines = codeBox.value.split('\n');
  let textAbove = '';
  for (let i = 0; i < lineNum; i++)
    textAbove += allLines[i] + '\n';
  mirror.textContent = textAbove;
  const lineMarker = document.createElement('span');
  lineMarker.textContent = 'x';
  mirror.append(lineMarker);
  document.body.append(mirror);
  codeBox.scrollTop = lineMarker.offsetTop - parseFloat(style.paddingTop);
  mirror.remove();
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
  const nodeEl = (event.target as HTMLElement).closest('g.node');
  const id = nodeEl ? getNodeId(nodeEl) : null;
  if (id)
    selectNodeSourceLine(id);
  selectEditorNode(id);
  if (id) {
    const graph = getEditorGraph();
    const node = graph.nodes.get(id);
    if (node?.kind === 'question') {
      state.phoneFocusNodeId = id;
      state.phoneFocusUsesDecisionContext = true;
      state.phonePreviewChoiceId = null;
      render();
    }
    else {
      const feedingChoice = findNearestFeedingChoice(id, graph);
      if (feedingChoice) {
        state.phoneFocusNodeId = null;
        state.phoneFocusUsesDecisionContext = false;
        state.phonePreviewChoiceId = feedingChoice;
        render();
      }
    }
  }
};
outputBox.addEventListener('click', selectClickedNode);

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
  if (state.currentBottomQ) {
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
