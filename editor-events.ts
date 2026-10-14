import { codeBox, diagramBox, outputBox, phoneDiagramBox } from './dom.ts';
import { nodeIdOf } from './render-helpers.ts';
import { selectEditorNode } from './editor-actions.ts';
import { editorGraph } from './editor-graph.ts';
import { phonePath, state } from './state.ts';
import { render } from './render.ts';
import { nearestFeedingChoice } from './decision-nav.ts';
import { findAnswersLeadingTo, isPhoneShowingHistory } from './phone-render.ts';
import { parseEdges } from './diagram-source.ts';
import { parentOf } from './graph-slice.ts';
import { writeChosenPath } from './path-export.ts';
import './editor-inspector-events.ts';
import './editor-class-events.ts';

outputBox.addEventListener('click', (event) => {
  const nodeEl = (event.target as HTMLElement).closest('g.node');
  const id = nodeEl ? nodeIdOf(nodeEl) : null;
  selectEditorNode(id);
  if (id) {
    const graph = editorGraph();
    const node = graph.nodes.get(id);
    if (node?.kind === 'question') {
      state.phoneFocusNodeId = id;
      state.phoneFocusUsesDecisionContext = true;
      state.phonePreviewChoiceId = null;
      render();
    }
    else {
      const feedingChoice = nearestFeedingChoice(id, graph);
      if (feedingChoice) {
        state.phoneFocusNodeId = null;
        state.phoneFocusUsesDecisionContext = false;
        state.phonePreviewChoiceId = feedingChoice;
        render();
      }
    }
  }
});

phoneDiagramBox.addEventListener('click', async (event) => {
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
      const answers = findAnswersLeadingTo(parentOf(choiceId, edges), edges, editorGraph());
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
});
