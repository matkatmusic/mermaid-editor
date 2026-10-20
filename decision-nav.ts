import type { EditorGraph, EditorNode } from './editor-types.ts';
import { getEditorGraph } from './editor-graph.ts';
import { state } from './state.ts';
import { decisionCounter, diagramBox, outputBox } from './dom.ts';
import { reportEditorValidationError } from './render-helpers.ts';
import { setStatus } from './diagram-io.ts';
import { selectEditorNode } from './editor-actions.ts';
import { render } from './render.ts';
import { findNearestFeedingChoice } from './decision-search.ts';

function compareLineIndex(a: EditorNode, b: EditorNode) {
  return a.lineIndex - b.lineIndex;
}

export function listDecisionNodes(graph: EditorGraph) {
  // editorGraph only exposes validated, standalone declarations. A question is therefore exactly a standalone brace-shaped decision for navigation.
  const decisions: EditorNode[] = [];
  for (const node of graph.nodes.values()) {
    const isQuestion = node.kind === 'question';
    if (isQuestion)
      decisions.push(node);
  }
  decisions.sort(compareLineIndex);
  return decisions;
}

export function clearInvalidPhonePreview(graph: EditorGraph) {
  const hasFocus = !!state.phoneFocusNodeId;
  const isFocusNotQuestion = graph.nodes.get(state.phoneFocusNodeId ?? '')?.kind !== 'question';
  const isFocusInvalid = hasFocus && isFocusNotQuestion;
  if (isFocusInvalid) {
    state.phoneFocusNodeId = null;
    state.phoneFocusUsesDecisionContext = false;
  }
  const hasPreview = !!state.phonePreviewChoiceId;
  if (!hasPreview)
    return;
  const feedingChoice = findNearestFeedingChoice(state.phonePreviewChoiceId!, graph);
  const isPreviewInvalid = feedingChoice !== state.phonePreviewChoiceId;
  if (isPreviewInvalid)
    state.phonePreviewChoiceId = null;
}

export function updateDecisionCounter(graph: EditorGraph) {
  const decisions = listDecisionNodes(graph);
  if (decisions.length === 0) {
    state.currentDecisionId = null;
    decisionCounter.textContent = '0 / 0';
    return decisions;
  }
  let hasCurrentDecision = false;
  for (const node of decisions) {
    const isCurrent = node.id === state.currentDecisionId;
    if (isCurrent) {
      hasCurrentDecision = true;
      break;
    }
  }
  if (!hasCurrentDecision) {
    let selectedDecisionId: string | undefined;
    for (const node of decisions) {
      const isSelected = node.id === state.selectedEditorNodeId;
      if (isSelected) {
        selectedDecisionId = node.id;
        break;
      }
    }
    state.currentDecisionId = selectedDecisionId ?? decisions[0].id;
  }
  let current = 0;
  for (let i = 0; i < decisions.length; i++) {
    const isCurrent = decisions[i].id === state.currentDecisionId;
    if (isCurrent) {
      current = i + 1;
      break;
    }
  }
  decisionCounter.textContent = `${current} / ${decisions.length}`;
  return decisions;
}

export function moveNodeToViewportCenter(container: HTMLElement, diagram: Element, id: string) {
  const node = diagram.querySelector('[id*="flowchart-' + id + '-"]');
  if (!node)
    return;
  const containerRect = container.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  container.scrollLeft += nodeRect.left + nodeRect.width / 2 - containerRect.left - container.clientWidth / 2;
  container.scrollTop += nodeRect.top + nodeRect.height / 2 - containerRect.top - container.clientHeight / 2;
}

export async function moveToDecision(step: 1 | -1) {
  let graph: EditorGraph;
  try {
    graph = getEditorGraph();
  }
  catch (error) {
    reportEditorValidationError(error);
    return;
  }
  const decisions = updateDecisionCounter(graph);
  if (decisions.length === 0) {
    setStatus('No decisions in this diagram');
    return;
  }
  const selected = graph.nodes.get(state.selectedEditorNodeId ?? '');
  // const nearest = selected ? findNearestDecision(selected.id, step, graph) : undefined;
  const anchorId = selected?.kind === 'question' ? selected.id : state.currentDecisionId;
  let currentIndex = -1;
  for (let i = 0; i < decisions.length; i++) {
    const isAnchor = decisions[i].id === anchorId;
    if (isAnchor) {
      currentIndex = i;
      break;
    }
  }
  const nextIndex = (currentIndex + step + decisions.length) % decisions.length;
  const decision = decisions[nextIndex];
  state.currentDecisionId = decision.id;
  state.phoneFocusNodeId = decision.id;
  state.phoneFocusUsesDecisionContext = true;
  state.phonePreviewChoiceId = null;
  selectEditorNode(decision.id);
  updateDecisionCounter(graph);
  await render();
  // A slow render can let another change clobber selection mid-await, so reassert it after.
  selectEditorNode(decision.id);
  updateDecisionCounter(graph);
  moveNodeToViewportCenter(outputBox, diagramBox, decision.id);
}
