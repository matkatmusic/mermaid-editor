import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression } from "./cdp.ts";
import { assertEditorSourceIsSavedAndValid, openEditorDrawer, resetEditorFixture, executeEditorAction, selectEditorNode, setEditorSource } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test("test_add_question_after_terminal_block_creates_two_choices", async () => {
  await resetEditorFixture();
  // Step: select the terminal block "Have the conversation" and add a question after it.
  await selectEditorNode("B_HaveConvo");
  await executeEditorAction("addQuestionAfter");
  const source = await executeExpression("codeBox.value");
  // Step: the new question is spliced in with two default choices.
  assert.ok(source.includes("B_HaveConvo --> Q_NEW_1"));
  assert.ok(source.includes('Q_NEW_1{"New question"}'));
  assert.ok(source.includes('Q_CHOICE_NEW_1_Y["Yes"]'));
  assert.ok(source.includes('Q_CHOICE_NEW_1_N["No"]'));
  assert.ok(source.includes("Q_NEW_1 --> Q_CHOICE_NEW_1_Y"));
  assert.ok(source.includes("Q_NEW_1 --> Q_CHOICE_NEW_1_N"));
  await assertEditorSourceIsSavedAndValid();
});

test("test_add_question_in_middle_splices_each_former_successor", async () => {
  await resetEditorFixture();
  // Step: select the start node and add a question after it.
  await selectEditorNode("B_Start");
  await executeEditorAction("addQuestionAfter");
  const source = await executeExpression("codeBox.value");
  // Step: the new question sits between Start and the former successor Q1, reached by both choices.
  assert.ok(source.includes("B_Start --> Q_NEW_1"));
  assert.ok(source.includes("Q_CHOICE_NEW_1_Y --> Q_Q1"));
  assert.ok(source.includes("Q_CHOICE_NEW_1_N --> Q_Q1"));
  assert.ok(!source.includes("B_Start --> Q_Q1"));
  await assertEditorSourceIsSavedAndValid();
});

test("test_add_block_after_terminal_block", async () => {
  await resetEditorFixture();
  // Step: select the terminal block "Let it go" and add a block after it.
  await selectEditorNode("B_LetGo");
  await executeEditorAction("addBlockAfter");
  const source = await executeExpression("codeBox.value");
  // Step: the new block is appended after it.
  assert.ok(source.includes("B_LetGo --> B_NEW_1"));
  assert.ok(source.includes('B_NEW_1["New block"]'));
  await assertEditorSourceIsSavedAndValid();
});

test("test_add_block_in_middle_splices_the_edge", async () => {
  await resetEditorFixture();
  // Step: select the start node and add a block after it.
  await selectEditorNode("B_Start");
  await executeEditorAction("addBlockAfter");
  const source = await executeExpression("codeBox.value");
  // Step: the new block sits between Start and the former successor Q1.
  assert.ok(source.includes("B_Start --> B_NEW_1"));
  assert.ok(source.includes("B_NEW_1 --> Q_Q1"));
  assert.ok(!source.includes("B_Start --> Q_Q1"));
  await assertEditorSourceIsSavedAndValid();
});

test("test_remove_block_deletes_the_selected_terminal_block", async () => {
  await resetEditorFixture();
  // Step: select the terminal block "Let it go" and remove it.
  await selectEditorNode("B_LetGo");
  await executeEditorAction("removeBlock");
  const source = await executeExpression("codeBox.value");
  // Step: its declaration and every inbound edge are gone; it has no successors, so nothing is reconnected.
  assert.ok(!source.includes('B_LetGo["Let it go"]'));
  assert.ok(!source.includes("--> B_LetGo"));
  await assertEditorSourceIsSavedAndValid();
});

test("test_remove_block_deletes_the_selected_block_and_reconnects_its_neighbors", async () => {
  // Scenario: splice a block into B_Start --> Q_Q1, remove it, and check the edge heals.
  await resetEditorFixture();
  // Step: splice a new static block between B_Start and Q_Q1 so it has one predecessor and one successor.
  await selectEditorNode("B_Start");
  await executeEditorAction("addBlockAfter");
  let source = await executeExpression("codeBox.value");
  const splicedId = source.match(/B_Start --> (B_NEW_\d+)/)[1];
  assert.ok(source.includes(`${splicedId} --> Q_Q1`));
  assert.ok(!source.includes("B_Start --> Q_Q1"));
  // Step: remove the spliced block; its one predecessor reconnects straight to its one successor.
  await selectEditorNode(splicedId);
  await executeEditorAction("removeBlock");
  source = await executeExpression("codeBox.value");
  assert.ok(!source.includes(`${splicedId}["New block"]`));
  assert.ok(source.includes("B_Start --> Q_Q1"));
  await assertEditorSourceIsSavedAndValid();
});

test("test_remove_choice_orphans_its_downstream_path", async () => {
  await resetEditorFixture();
  // Step: remove Q1's existing "No" choice node; its downstream path (Let it go) is orphaned, not deleted.
  await selectEditorNode("Q_CHOICE_Q1_NEW2");
  await executeEditorAction("removeChoice");
  const source = await executeExpression("codeBox.value");
  assert.ok(!source.includes('Q_CHOICE_Q1_NEW2["No"]'));
  assert.ok(source.includes('B_LetGo["Let it go"]'));
  await assertEditorSourceIsSavedAndValid();
});

test("test_add_choice_normalizes_the_first_labelled_question_branch", async () => {
  await resetEditorFixture();
  // Step: select a decision with a labelled branch and add a choice; that branch becomes an explicit choice node.
  await setEditorSource('flowchart TD\n  B_START["Start"]\n  Q_Q1{"Can I be calm?"}\n  B_LETGO["Let it go"]\n  B_START --> Q_Q1\n  Q_Q1 -- "No" --> B_LETGO');
  await selectEditorNode("Q_Q1");
  await executeEditorAction("addChoice");
  const source = await executeExpression("codeBox.value");
  assert.ok(source.includes('Q_CHOICE_Q1_NO["No"]'));
  assert.ok(source.includes("Q_Q1 --> Q_CHOICE_Q1_NO"));
  assert.ok(source.includes("Q_CHOICE_Q1_NO --> B_LETGO"));
  await assertEditorSourceIsSavedAndValid();
});
