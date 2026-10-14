import type { Edge } from './dom.ts';
import type { EditorGraph } from './editor-types.ts';
import { state } from './state.ts';
import { siblingIds, sliceIds } from './graph-slice.ts';
import { buildHistoryRows, type Row } from './phone-render.ts';

function buildRowsFromIdSequence(ids: string[], graph: EditorGraph, activeId: string, leadChosenId: string | undefined, leadDeclinedIds: string[]): Row[] {
  const rows: Row[] = [];
  const seen = new Set<string>();
  const leadQuestionId = ids[0];
  for (const id of ids) {
    const alreadySeen = seen.has(id);
    if (alreadySeen)
      continue;
    seen.add(id);
    const kind = graph.nodes.get(id)?.kind;
    const isChoice = kind === 'choice';
    if (isChoice)
      continue;
    const isBlock = kind === 'block';
    if (isBlock) {
      rows.push({ status: 'block', id });
      continue;
    }
    const isQuestion = kind === 'question';
    if (!isQuestion)
      continue;
    const isActive = id === activeId;
    if (isActive) {
      rows.push({ status: 'active', id });
      continue;
    }
    const isLeadQuestion = id === leadQuestionId;
    const hasLeadChoice = leadChosenId !== undefined;
    const isAnsweredLeadQuestion = isLeadQuestion && hasLeadChoice;
    if (isAnsweredLeadQuestion)
      rows.push({ status: 'past', id, chosenChoiceId: leadChosenId!, declinedChoiceIds: leadDeclinedIds });
  }
  return rows;
}

// Previews a main-view-clicked decision on the phone: masked lead-in, open focus, nothing revert-clickable.
function buildFocusRows(edges: Edge[], graph: EditorGraph, focusNodeId: string): Row[] {
  const ids = sliceIds(edges);
  const siblings = siblingIds(ids, edges);
  return buildRowsFromIdSequence(ids, graph, focusNodeId, ids[1], siblings);
}

function buildPreviewRows(edges: Edge[], graph: EditorGraph): Row[] {
  const ids = sliceIds(edges);
  const siblings = siblingIds(ids, edges);
  const reversedIds = [...ids].reverse();
  let activeId: string | undefined;
  for (const id of reversedIds) {
    const isQuestion = graph.nodes.get(id)?.kind === 'question';
    const isLeadQuestion = id === ids[0];
    const isEarlierQuestion = isQuestion && !isLeadQuestion;
    if (isEarlierQuestion) {
      activeId = id;
      break;
    }
  }
  return buildRowsFromIdSequence(ids, graph, activeId ?? ids[0], ids[1], siblings);
}

export function buildRows(edges: Edge[], graph: EditorGraph): Row[] {
  const hasFocusedDecision = !state.functionsOnly && state.phoneFocusUsesDecisionContext && !!state.phoneFocusNodeId;
  if (hasFocusedDecision)
    return buildFocusRows(edges, graph, state.phoneFocusNodeId!);
  const hasPreviewChoice = !state.functionsOnly && !!state.phonePreviewChoiceId;
  if (hasPreviewChoice)
    return buildPreviewRows(edges, graph);
  return buildHistoryRows(edges, graph);
}
