import { codeBox, inspectorNotice, nodeInspector, nodeNameCheck, nodeNameInput } from '../../../dom.ts';
import { buildPropsLine, parsePropsLine } from '../../model/node-props.ts';
import type { EditorGraph, EditorNode, EditorNodeKind } from '../../model/editor-types.ts';
import { phonePath, state } from '../../../state.ts';
import { applyEditorSource, appendEditorAction } from './editor-actions.ts';
import { getEditorGraph } from '../../model/editor-graph.ts';

const KIND_PREFIXES: Record<EditorNodeKind, string> = { question: 'Q_', block: 'B_', choice: 'Q_CHOICE_' };
const CHOICE_PREFIX = KIND_PREFIXES.choice;

type RenamePlan = { error: string } | { renames: Map<string, string> };

// The kind prefix stays; a question also renames its own choices Q_CHOICE_<old>_<answer>.
export function buildRenamePlan(graph: EditorGraph, oldId: string, newId: string): RenamePlan {
  const node = graph.nodes.get(oldId)!;
  if (newId === '')
    return { error: 'The identifier can not be empty.' };
  if (!/^[A-Za-z0-9_]+$/.test(newId))
    return { error: 'Use only letters, digits and _ in the identifier.' };
  const prefix = KIND_PREFIXES[node.kind];
  const isQuestionWithChoicePrefix = node.kind === 'question' && newId.startsWith(CHOICE_PREFIX);
  if (!newId.startsWith(prefix) || isQuestionWithChoicePrefix)
    return { error: `The identifier must start with ${prefix}` };
  if (newId === prefix)
    return { error: `Add a name after ${prefix}` };
  const renames = new Map<string, string>();
  if (newId === oldId)
    return { renames };
  renames.set(oldId, newId);
  if (node.kind === 'question') {
    const oldChoicePrefix = `${CHOICE_PREFIX}${oldId.slice(prefix.length)}_`;
    const newChoicePrefix = `${CHOICE_PREFIX}${newId.slice(prefix.length)}_`;
    for (const edge of graph.edges) {
      const isChoiceOfQuestion = edge.from === oldId && edge.to.startsWith(oldChoicePrefix);
      if (isChoiceOfQuestion)
        renames.set(edge.to, newChoicePrefix + edge.to.slice(oldChoicePrefix.length));
    }
  }
  for (const to of renames.values()) {
    const isUsed = graph.nodes.has(to);
    if (isUsed)
      return { error: `The identifier ${to} is already used.` };
  }
  return { renames };
}

// Whole words only, so renaming Q_MOOD leaves Q_MOODY alone. Note text is the user's own words, so a props line changes only its blockId.
export function buildRenamedSource(source: string, renames: Map<string, string>) {
  const names = [...renames.keys()].map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const wordPattern = new RegExp(`(?<![A-Za-z0-9_])(?:${names.join('|')})(?![A-Za-z0-9_])`, 'g');
  const lines = source.split('\n');
  const renamedLines: string[] = [];
  for (const line of lines) {
    // const isNoteLine = line.trimStart().startsWith(NOTE_PREFIX);
    // renamedLines.push(isNoteLine ? line : line.replace(wordPattern, (word) => renames.get(word)!));
    // const note = parseNoteLine(line);
    // if (note) {
    //   renamedLines.push(line.replace(`[${note.id}]`, `[${renames.get(note.id) ?? note.id}]`));
    //   continue;
    // }
    const props = parsePropsLine(line);
    if (props) {
      const indent = line.match(/^\s*/)![0];
      const blockId = renames.get(props.blockId) ?? props.blockId;
      renamedLines.push(`${indent}${buildPropsLine({ ...props, blockId })}`);
      continue;
    }
    renamedLines.push(line.replace(wordPattern, (word) => renames.get(word)!));
  }
  return renamedLines.join('\n');
}

function renameStateIds(renames: Map<string, string>) {
  const rename = (id: string | null) => (id === null ? null : renames.get(id) ?? id);
  for (let i = 0; i < phonePath.length; i++)
    phonePath[i] = rename(phonePath[i])!;
  state.selectedEditorNodeId = rename(state.selectedEditorNodeId);
  state.phoneStartNodeId = rename(state.phoneStartNodeId);
  state.phoneClickedNodeId = rename(state.phoneClickedNodeId);
  state.phoneFocusNodeId = rename(state.phoneFocusNodeId);
  state.phonePreviewChoiceId = rename(state.phonePreviewChoiceId);
  state.currentDecisionId = rename(state.currentDecisionId);
  const view = state.pathView;
  if (view) {
    view.clickedIds = view.clickedIds.map((id) => rename(id)!);
    view.clickHistory = view.clickHistory.map((ids) => ids.map((id) => rename(id)!));
    view.decisionDigits = Object.fromEntries(Object.entries(view.decisionDigits).map(([id, digit]) => [rename(id)!, digit]));
  }
}

export function getParentQuestionId(graph: EditorGraph, choiceId: string) {
  for (const edge of graph.edges) {
    const isFromQuestion = edge.to === choiceId && graph.nodes.get(edge.from)?.kind === 'question';
    if (isFromQuestion)
      return edge.from;
  }
  return undefined;
}

// The part of the id the user edits: no kind prefix and, for a choice, no parent name.
export function getNodeNamePart(graph: EditorGraph, node: EditorNode) {
  if (node.kind !== 'choice')
    return node.id.slice(KIND_PREFIXES[node.kind].length);
  const parentId = getParentQuestionId(graph, node.id);
  if (parentId === undefined)
    return node.id.slice(CHOICE_PREFIX.length);
  const parentPrefix = `${CHOICE_PREFIX}${parentId.slice(KIND_PREFIXES.question.length)}_`;
  const startsWithParentPrefix = node.id.startsWith(parentPrefix);
  return node.id.slice(startsWithParentPrefix ? parentPrefix.length : CHOICE_PREFIX.length);
}

function buildFullId(graph: EditorGraph, node: EditorNode, name: string) {
  if (node.kind !== 'choice')
    return `${KIND_PREFIXES[node.kind]}${name}`;
  const parentId = getParentQuestionId(graph, node.id);
  if (parentId === undefined)
    return `${CHOICE_PREFIX}${name}`;
  return `${CHOICE_PREFIX}${parentId.slice(KIND_PREFIXES.question.length)}_${name}`;
}

export type NameCheck = { fullId: string } | { error: string };

export function checkNodeName(graph: EditorGraph, node: EditorNode, name: string): NameCheck {
  if (name === '')
    return { error: 'error: node name cannot be empty' };
  const illegalCharacters: string[] = [];
  for (const character of name) {
    const isLegal = /[A-Za-z0-9_]/.test(character);
    const label = character === ' ' ? 'space' : character;
    if (!isLegal && !illegalCharacters.includes(label))
      illegalCharacters.push(label);
  }
  if (illegalCharacters.length > 0)
    return { error: `error: node names cannot contain ${illegalCharacters.join(', ')}` };
  const fullId = buildFullId(graph, node, name);
  if (fullId === node.id)
    return { fullId };
  if (graph.nodes.has(fullId))
    return { error: `error: ${fullId} is already used` };
  const plan = buildRenamePlan(graph, node.id, fullId);
  if ('error' in plan)
    return { error: `error: ${plan.error}` };
  return { fullId };
}

export function showNameCheck(check: NameCheck) {
  const isError = 'error' in check;
  nodeNameCheck.textContent = isError ? check.error : `result: ${check.fullId}`;
  nodeNameCheck.classList.toggle('error', isError);
}

// Live check on every key stroke.
export function checkTypedNodeName() {
  const node = getEditorGraph().nodes.get(state.selectedEditorNodeId ?? '');
  if (!node)
    return;
  showNameCheck(checkNodeName(getEditorGraph(), node, nodeNameInput.value));
}

export function isNodeNameBoxInvalid() {
  if (nodeInspector.hidden)
    return false;
  const graph = getEditorGraph();
  const node = graph.nodes.get(state.selectedEditorNodeId ?? '');
  if (!node)
    return false;
  return 'error' in checkNodeName(graph, node, nodeNameInput.value);
}

let hideNoticeTimer: ReturnType<typeof setTimeout> | undefined;

export function showInspectorNotice(text: string) {
  inspectorNotice.textContent = text;
  inspectorNotice.hidden = false;
  clearTimeout(hideNoticeTimer);
  hideNoticeTimer = setTimeout(hideInspectorNotice, 4000);
}

// A click, Cmd-click or arrow key may not move the selection away from a bad Node Name; the pop-up says why.
export function refuseMoveWhileNodeNameIsInvalid() {
  if (!isNodeNameBoxInvalid())
    return false;
  // inspectorNotice.textContent = 'Fix the bad Node Name first.';
  // inspectorNotice.hidden = false;
  // clearTimeout(hideNoticeTimer);
  // hideNoticeTimer = setTimeout(hideInspectorNotice, 4000);
  showInspectorNotice('Fix the bad Node Name first.');
  return true;
}

function hideInspectorNotice() {
  inspectorNotice.hidden = true;
}

// Blur, Enter or Tab: a valid name renames the node; an invalid name puts the old name back and keeps the error.
export function commitNodeName(oldId = state.selectedEditorNodeId, name = nodeNameInput.value) {
  if (!oldId)
    return;
  const graph = getEditorGraph();
  const node = graph.nodes.get(oldId);
  if (!node)
    return;
  const check = checkNodeName(graph, node, name);
  if ('error' in check) {
    const isStillSelected = state.selectedEditorNodeId === oldId;
    if (isStillSelected) {
      nodeNameInput.value = getNodeNamePart(graph, node);
      showNameCheck(check);
    }
    return;
  }
  renameNodeIdentifier(oldId, check.fullId);
}

export function renameNodeIdentifier(oldId: string | null, newId: string) {
  if (!oldId)
    return;
  async function applyRename() {
    const graph = getEditorGraph();
    // An earlier commit (for example Enter, then the change event) already renamed this node.
    if (!graph.nodes.has(oldId!))
      return;
    const plan = buildRenamePlan(graph, oldId!, newId);
    if ('error' in plan) {
      const isStillSelected = state.selectedEditorNodeId === oldId;
      if (isStillSelected) {
        nodeNameInput.value = getNodeNamePart(graph, graph.nodes.get(oldId!)!);
        showNameCheck({ error: `error: ${plan.error}` });
      }
      return;
    }
    if (plan.renames.size === 0)
      return;
    renameStateIds(plan.renames);
    await applyEditorSource(buildRenamedSource(codeBox.value, plan.renames));
  }
  appendEditorAction(applyRename);
}
