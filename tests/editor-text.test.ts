import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "./browser-harness.ts";
import { executeExpression } from "./cdp.ts";
import { EDITOR_FIXTURE_NAME } from "./fixtures.ts";
import { assertEditorSourceIsSavedAndValid, dispatchNodeClick, openEditorDrawer, resetEditorFixture, executeEditorAction, selectEditorNode } from "./editor-helpers.ts";
import { inspectorState } from "./inspector-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test("test_inline_question_text_edit_persists", async () => {
  await resetEditorFixture();
  // Step: click the Q1 question node, type a new label into the inspector's Text input, and press Enter.
  await dispatchNodeClick("Q_Q1");
  await executeExpression("(() => { const input = document.getElementById('nodeTextInput'); input.value = 'Can I stay calm?'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()");
  await executeExpression("window.editorActionPromise");
  const source = await executeExpression("codeBox.value");
  // Step: the question's declaration is rewritten with brace syntax.
  assert.ok(source.includes('Q_Q1{"Can I stay calm?"}'));
  // Step: the edited node stays selected; the inspector keeps showing it after the commit.
  // assert.equal((await inspectorState()).hidden, true);
  assert.equal((await inspectorState()).hidden, false);
  await assertEditorSourceIsSavedAndValid();
});

test("test_inline_static_block_text_edit_persists", async () => {
  await resetEditorFixture();
  // Step: click the LetGo block node, type a new label into the inspector's Text input, and press Enter.
  await dispatchNodeClick("B_LetGo");
  await executeExpression("(() => { const input = document.getElementById('nodeTextInput'); input.value = 'Pause the conversation'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()");
  await executeExpression("window.editorActionPromise");
  const source = await executeExpression("codeBox.value");
  // Step: the block's declaration is rewritten with rectangle syntax.
  assert.ok(source.includes('B_LetGo["Pause the conversation"]'));
  await assertEditorSourceIsSavedAndValid();
});

test("test_question_removal_preview_cancel_confirm_undo_and_redo_persist", async () => {
  await resetEditorFixture();
  // Step: start removing Q1, cycle to the other candidate path, then cancel; nothing changes.
  await selectEditorNode("Q_Q1");
  await executeEditorAction("removeQuestion");
  await executeExpression("document.getElementById('nextRemovalPathBtn').click()");
  await executeExpression("document.getElementById('cancelRemoveQuestionBtn').click()");
  let source = await executeExpression("codeBox.value");
  assert.ok(source.includes('Q_Q1{"Can I be calm?"}'));

  // Step: remove Q1 again, cycle to the other candidate path, and confirm.
  await selectEditorNode("Q_Q1");
  await executeEditorAction("removeQuestion");
  await executeExpression("document.getElementById('nextRemovalPathBtn').click()");
  await executeExpression("document.getElementById('confirmRemoveQuestionBtn').click()");
  await executeExpression("window.editorActionPromise");
  source = await executeExpression("codeBox.value");
  // Step: Q1 is gone, and the source is saved to disk and parses cleanly.
  assert.ok(!source.includes('Q_Q1{"Can I be calm?"}'));
  const savedAfterConfirm = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`).then((r) => r.text());
  assert.equal(savedAfterConfirm, source);
  await executeExpression(`mermaid.parse(${JSON.stringify(source)})`);

  // Step: undo brings Q1 back.
  await executeExpression("window.applyEditorUndo(); window.editorActionPromise");
  source = await executeExpression("codeBox.value");
  assert.ok(source.includes('Q_Q1{"Can I be calm?"}'));

  // Step: redo removes it again.
  await executeExpression("window.applyEditorRedo(); window.editorActionPromise");
  source = await executeExpression("codeBox.value");
  assert.ok(!source.includes('Q_Q1{"Can I be calm?"}'));
});
