import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { evaluate } from "./cdp.ts";
import { assertEditorSourceIsSavedAndValid, clickNode, openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickInspectorAction, inspectorActions, inspectorState } from "./inspector-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test('test_inspector_add_after_controls_exist_only_for_static_and_choice_blocks', async () => {
  await resetEditorFixture();
  await clickNode('B_LetGo');
  assert.deepEqual(await inspectorActions(), [
    { action: 'remove', text: 'Remove', spanTwoColumns: false },
    { action: 'add-decision-after', text: 'add Decision block after', spanTwoColumns: false },
    { action: 'insert-decision-after', text: 'Insert decision block after', spanTwoColumns: false },
    { action: 'insert-static-after', text: 'Insert static block after', spanTwoColumns: false },
    { action: 'insert-static-before', text: 'insert static block before', spanTwoColumns: false },
    { action: 'insert-decision-before', text: 'insert Decision & leading choice before', spanTwoColumns: false },
  ]);
  await clickNode('Q_CHOICE_Q1_NEW2');
  assert.deepEqual(await inspectorActions(), [
    { action: 'remove', text: 'Remove', spanTwoColumns: false },
    { action: 'add-decision-after', text: 'add Decision block after', spanTwoColumns: false },
    { action: 'add-static-after', text: 'add static block after', spanTwoColumns: false },
    { action: 'insert-decision-after', text: 'Insert decision block after', spanTwoColumns: false },
    { action: 'insert-static-after', text: 'Insert static block after', spanTwoColumns: false },
  ]);
  await clickNode('Q_Q1');
  assert.deepEqual(await inspectorActions(), [
    { action: 'remove', text: 'Remove', spanTwoColumns: false },
    { action: 'add-choice', text: 'Add choice', spanTwoColumns: false },
    { action: 'remove-choices', text: 'Remove choices', spanTwoColumns: false },
    { action: 'insert-static-before', text: 'insert static block before', spanTwoColumns: false },
    { action: 'insert-decision-before', text: 'insert Decision & leading choice before', spanTwoColumns: false },
  ]);
});

test('test_inspector_remove_button_dispatches_removal_by_node_kind', async () => {
  await resetEditorFixture();
  // Step: Remove on a static block reconnects every predecessor to every successor.
  await clickNode('B_LetGo');
  await clickInspectorAction('remove');
  let source = await evaluate('codeBox.value');
  assert.ok(!source.includes('B_LetGo["Let it go"]'));
  assert.equal((await inspectorState()).hidden, true);
  await assertEditorSourceIsSavedAndValid();

  // Step: Remove on an explicit choice node orphans its downstream path.
  await resetEditorFixture();
  await clickNode('Q_CHOICE_Q1_NEW2');
  await clickInspectorAction('remove');
  source = await evaluate('codeBox.value');
  assert.ok(!source.includes('Q_CHOICE_Q1_NEW2["No"]'));
  assert.ok(source.includes('B_LetGo["Let it go"]'));
  assert.equal((await inspectorState()).hidden, true);
  await assertEditorSourceIsSavedAndValid();

  // Step: Remove on a Decision enters the replacement-path preview instead of committing immediately.
  await resetEditorFixture();
  await clickNode('Q_Q1');
  await clickInspectorAction('remove');
  const preview = await evaluate(`JSON.stringify({
    previewHidden: document.getElementById('nodeInspectorRemovalPreview').hidden,
    actionsHidden: document.getElementById('nodeInspectorActions').hidden,
  })`).then(JSON.parse);
  assert.equal(preview.previewHidden, false);
  assert.equal(preview.actionsHidden, true);
  await evaluate("document.getElementById('cancelRemoveQuestionBtn').click()");
  assert.equal((await inspectorState()).hidden, true);
});

test('test_inspector_remove_choices_button_orphans_every_outgoing_branch', async () => {
  await resetEditorFixture();
  // Step: select Q1 and use the inspector's Remove choices action.
  await clickNode('Q_Q1');
  await clickInspectorAction('remove-choices');
  const source = await evaluate('codeBox.value');
  // Step: both branches are gone from Q1, including their explicit choice nodes.
  assert.ok(!source.includes('Q_Q1 --> Q_CHOICE_Q1_NEW'));
  assert.ok(!source.includes('Q_CHOICE_Q1_NEW["Yes"]'));
  assert.ok(!source.includes('Q_Q1 --> Q_CHOICE_Q1_NEW2'));
  assert.ok(!source.includes('Q_CHOICE_Q1_NEW2["No"]'));
  // Step: the orphaned downstream nodes remain in the source.
  assert.ok(source.includes('B_LetGo["Let it go"]'));
  assert.ok(source.includes('Q_Q2{"Can they be calm?"}'));
  // Step: Q1 itself still exists (only its choices were removed), so it stays selected.
  // assert.equal((await inspectorState()).hidden, true);
  assert.equal((await inspectorState()).hidden, false);
  await assertEditorSourceIsSavedAndValid();

  // Step: removing choices deletes a shared choice node; other nodes stay.
  await setEditorSource('flowchart TD\n  Q_Q{"Q"}\n  Q_CHOICE_Q_X["X"]\n  B_DOWN["Down"]\n  B_OTHER["Other"]\n  Q_Q --> Q_CHOICE_Q_X\n  Q_CHOICE_Q_X --> B_DOWN\n  B_OTHER --> Q_CHOICE_Q_X');
  await clickNode('Q_Q');
  await clickInspectorAction('remove-choices');
  const sharedSource = await evaluate('codeBox.value');
  assert.ok(!sharedSource.includes('Q_CHOICE_Q_X'));
  assert.ok(sharedSource.includes('Q_Q{"Q"}'));
  assert.ok(sharedSource.includes('B_DOWN["Down"]'));
  assert.ok(sharedSource.includes('B_OTHER["Other"]'));
  await assertEditorSourceIsSavedAndValid();
});
