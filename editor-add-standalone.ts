import { applyEditorSource, selectEditorNode } from './editor-actions.ts';
import { getEditorGraph } from './editor-graph.ts';
import { setInspectorTextFocus } from './node-inspector-focus.ts';
import { buildChoiceId, buildSourceWithLinesReplaced, getNextEditorId } from './source-edit.ts';

export async function addStandaloneStaticBlock() {
  const graph = getEditorGraph();
  const staticId = getNextEditorId('B_NEW', graph);
  const newLines = [`  ${staticId}["New static block"]`];
  await applyEditorSource(buildSourceWithLinesReplaced(graph, new Set(), newLines));
  selectEditorNode(staticId);
  setInspectorTextFocus();
}

export async function addStandaloneDecisionBlock() {
  const graph = getEditorGraph();
  const decisionId = getNextEditorId('Q_NEW', graph);
  const yesId = buildChoiceId(decisionId, 'Y');
  const noId = buildChoiceId(decisionId, 'N');
  const newLines = [
    `  ${decisionId}{"New Decision"}`,
    `  ${yesId}["Yes"]`,
    `  ${noId}["No"]`,
    `  ${decisionId} --> ${yesId}`,
    `  ${decisionId} --> ${noId}`,
  ];
  await applyEditorSource(buildSourceWithLinesReplaced(graph, new Set(), newLines));
  selectEditorNode(decisionId);
  setInspectorTextFocus();
}
