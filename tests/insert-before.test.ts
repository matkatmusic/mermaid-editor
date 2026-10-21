import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression } from "./cdp.ts";
import { EDITOR_FIXTURE_NAME, editorFixtureSource } from "./fixtures.ts";
import { assertEditorSourceIsSavedAndValid, dispatchNodeClick, openEditorDrawer, resetEditorFixture } from "./editor-helpers.ts";
import { clickInspectorAction, inspectorState } from "./inspector-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test('test_insert_static_block_before_splices_incoming_edges_with_their_labels', async () => {
  await resetEditorFixture();
  // Step: select the fan-in target "Let it go" and insert a static block before it.
  await dispatchNodeClick('B_LetGo');
  const historyBefore = await executeExpression('editorHistory.length');
  await clickInspectorAction('insert-static-before');
  const source = await executeExpression('codeBox.value');
  // Step: the new static block is declared and sits directly before "Let it go".
  assert.ok(source.includes('B_NEW_1["New static block"]'));
  assert.ok(source.includes('B_NEW_1 --> B_LetGo'));
  assert.ok(source.includes('B_LetGo["Let it go"]'));
  // Step: every former incoming edge is redirected to the new block.
  assert.ok(source.includes('Q_CHOICE_Q1_NEW2 --> B_NEW_1'));
  assert.ok(source.includes('Q_CHOICE_Q2_NEW2 --> B_NEW_1'));
  assert.ok(source.includes('Q_CHOICE_Q3_NEW2 --> B_NEW_1'));
  assert.ok(source.includes('Q_CHOICE_Q4_NEW2 --> B_NEW_1'));
  assert.ok(!source.includes('Q_CHOICE_Q1_NEW2 --> B_LetGo'));
  assert.ok(!source.includes('Q_CHOICE_Q2_NEW2 --> B_LetGo'));
  assert.ok(!source.includes('Q_CHOICE_Q3_NEW2 --> B_LetGo'));
  assert.ok(!source.includes('Q_CHOICE_Q4_NEW2 --> B_LetGo'));
  // Step: "Let it go" still exists (a new predecessor was spliced in front of it), so it stays selected.
  // assert.equal((await inspectorState()).hidden, true);
  assert.equal((await inspectorState()).hidden, false);
  // Step: it is a single history entry.
  assert.equal(await executeExpression('editorHistory.length'), historyBefore + 1);
  // Step: undo restores the original source exactly.
  await executeExpression('window.applyEditorUndo(); window.editorActionPromise');
  assert.equal(await executeExpression('codeBox.value'), editorFixtureSource);
  await assertEditorSourceIsSavedAndValid();
});

test('test_insert_static_block_before_a_root_node_becomes_the_new_root', async () => {
  await resetEditorFixture();
  // Step: select "Start", which has no predecessor, and insert a static block before it.
  await dispatchNodeClick('B_Start');
  const historyBefore = await executeExpression('editorHistory.length');
  await clickInspectorAction('insert-static-before');
  const source = await executeExpression('codeBox.value');
  // Step: the new block leads into Start; Start keeps its own declaration untouched.
  assert.ok(source.includes('B_NEW_1["New static block"]'));
  assert.ok(source.includes('B_NEW_1 --> B_Start'));
  assert.ok(source.includes('B_Start["Something happened.<br/>Say something, or let it go?"]'));
  // Step: "Start" still exists (a new predecessor became the root instead), so it stays selected.
  // assert.equal((await inspectorState()).hidden, true);
  assert.equal((await inspectorState()).hidden, false);
  assert.equal(await executeExpression('editorHistory.length'), historyBefore + 1);
  await executeExpression('window.applyEditorUndo(); window.editorActionPromise');
  assert.equal(await executeExpression('codeBox.value'), editorFixtureSource);
  await assertEditorSourceIsSavedAndValid();
});

test('test_insert_decision_before_adds_one_leading_choice_and_splices_incoming_edges', async () => {
  await resetEditorFixture();
  // Step: select the fan-in target "Let it go" and insert a Decision & leading choice before it.
  await dispatchNodeClick('B_LetGo');
  const historyBefore = await executeExpression('editorHistory.length');
  await clickInspectorAction('insert-decision-before');
  const source = await executeExpression('codeBox.value');
  // Step: the new Decision has exactly one outgoing edge, to its new choice.
  assert.ok(source.includes('Q_NEW_1{"New Decision"}'));
  assert.ok(source.includes('Q_CHOICE_NEW_1_NEW["New choice"]'));
  assert.ok(source.includes('Q_NEW_1 --> Q_CHOICE_NEW_1_NEW'));
  const decisionOutgoing = source.match(/Q_NEW_1 -->/g) || [];
  assert.equal(decisionOutgoing.length, 1);
  // Step: the new choice leads to "Let it go", unlabelled.
  assert.ok(source.includes('Q_CHOICE_NEW_1_NEW --> B_LetGo'));
  assert.ok(source.includes('B_LetGo["Let it go"]'));
  // Step: every former incoming edge is redirected to the new Decision.
  assert.ok(source.includes('Q_CHOICE_Q1_NEW2 --> Q_NEW_1'));
  assert.ok(source.includes('Q_CHOICE_Q2_NEW2 --> Q_NEW_1'));
  assert.ok(source.includes('Q_CHOICE_Q3_NEW2 --> Q_NEW_1'));
  assert.ok(source.includes('Q_CHOICE_Q4_NEW2 --> Q_NEW_1'));
  assert.ok(!source.includes('Q_CHOICE_Q1_NEW2 --> B_LetGo'));
  // Step: "Let it go" still exists (a new Decision was spliced in front of it), so it stays selected.
  // assert.equal((await inspectorState()).hidden, true);
  assert.equal((await inspectorState()).hidden, false);
  assert.equal(await executeExpression('editorHistory.length'), historyBefore + 1);
  // Step: undo restores the original source exactly.
  await executeExpression('window.applyEditorUndo(); window.editorActionPromise');
  assert.equal(await executeExpression('codeBox.value'), editorFixtureSource);
  await assertEditorSourceIsSavedAndValid();
});

test('test_insert_decision_before_a_root_node_becomes_the_new_root', async () => {
  await resetEditorFixture();
  // Step: select "Start", which has no predecessor, and insert a Decision & leading choice before it.
  await dispatchNodeClick('B_Start');
  await clickInspectorAction('insert-decision-before');
  const source = await executeExpression('codeBox.value');
  assert.ok(source.includes('Q_NEW_1{"New Decision"}'));
  assert.ok(source.includes('Q_CHOICE_NEW_1_NEW["New choice"]'));
  assert.ok(source.includes('Q_NEW_1 --> Q_CHOICE_NEW_1_NEW'));
  const decisionOutgoing = source.match(/Q_NEW_1 -->/g) || [];
  assert.equal(decisionOutgoing.length, 1);
  assert.ok(source.includes('Q_CHOICE_NEW_1_NEW --> B_Start'));
  // Step: "Start" still exists (a new Decision became the root instead), so it stays selected.
  // assert.equal((await inspectorState()).hidden, true);
  assert.equal((await inspectorState()).hidden, false);
  await assertEditorSourceIsSavedAndValid();
});
