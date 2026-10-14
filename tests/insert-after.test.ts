import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { evaluate } from "./cdp.ts";
import { assertEditorSourceIsSavedAndValid, clickNode, openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { chooseDestination, clickInspectorAction, inspectorFocus, inspectorState } from "./inspector-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test('test_new_static_button_and_destination_option_have_identical_terminal_orphan_results', async () => {
  const fixture = 'flowchart TD\n  Q_Q{"Q"}\n  Q_CHOICE_Q_A["A"]\n  B_B["B"]\n  B_C["C"]\n  Q_Q --> Q_CHOICE_Q_A\n  Q_CHOICE_Q_A --> B_B\n  B_B --> B_C';
  await resetEditorFixture();
  await setEditorSource(fixture);
  await clickNode('Q_CHOICE_Q_A');
  const buttonHistoryLength = await evaluate('editorHistory.length');
  await clickInspectorAction('add-static-after');
  const buttonSource = await evaluate('codeBox.value');
  assert.ok(buttonSource.includes('Q_CHOICE_Q_A --> B_NEW_1'));
  assert.ok(buttonSource.includes('B_NEW_1["New static block"]'));
  assert.ok(!buttonSource.includes('Q_CHOICE_Q_A --> B_B'));
  assert.ok(buttonSource.includes('B_B --> B_C'));
  assert.equal((await inspectorState()).text, 'New static block');
  assert.deepEqual(await inspectorFocus(), { activeId: 'nodeTextInput', selectedId: 'B_NEW_1' });
  assert.equal(await evaluate('editorHistory.length'), buttonHistoryLength + 1);
  await assertEditorSourceIsSavedAndValid();

  await resetEditorFixture();
  await setEditorSource(fixture);
  await clickNode('Q_CHOICE_Q_A');
  const menuHistoryLength = await evaluate('editorHistory.length');
  await chooseDestination('new-static');
  assert.equal(await evaluate('codeBox.value'), buttonSource);
  assert.deepEqual(await inspectorFocus(), { activeId: 'nodeTextInput', selectedId: 'B_NEW_1' });
  assert.equal(await evaluate('editorHistory.length'), menuHistoryLength + 1);
  await assertEditorSourceIsSavedAndValid();
});

test('test_insert_static_after_splices_a_static_or_choice_node_without_dropping_its_destination', async () => {
  const fixture = 'flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_A --> B_B\n  B_B --> B_C';
  await resetEditorFixture();
  await setEditorSource(fixture);
  await clickNode('B_B');
  await clickInspectorAction('insert-static-after');
  let source = await evaluate('codeBox.value');
  assert.ok(source.includes('B_A --> B_B'));
  assert.ok(source.includes('B_B --> B_NEW_1'));
  assert.ok(source.includes('B_NEW_1["New static block"]'));
  assert.ok(source.includes('B_NEW_1 --> B_C'));
  assert.ok(!source.includes('B_B --> B_C'));
  await assertEditorSourceIsSavedAndValid();

  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  Q_PICK{"Q"}\n  Q_CHOICE_PICK_A["A"]\n  B_C["C"]\n  Q_PICK --> Q_CHOICE_PICK_A\n  Q_CHOICE_PICK_A --> B_C');
  await clickNode('Q_CHOICE_PICK_A');
  await clickInspectorAction('insert-static-after');
  source = await evaluate('codeBox.value');
  assert.ok(source.includes('Q_PICK --> Q_CHOICE_PICK_A'));
  assert.ok(source.includes('Q_CHOICE_PICK_A --> B_NEW_1'));
  assert.ok(source.includes('B_NEW_1 --> B_C'));
  assert.ok(!source.includes('Q_CHOICE_PICK_A --> B_C'));
  await assertEditorSourceIsSavedAndValid();
});

test('test_insert_static_after_a_terminal_node_matches_terminal_add_static_behavior', async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_A["A"]');
  await clickNode('B_A');
  await clickInspectorAction('insert-static-after');
  const source = await evaluate('codeBox.value');
  assert.ok(source.includes('B_A --> B_NEW_1'));
  assert.ok(source.includes('B_NEW_1["New static block"]'));
  assert.ok(!source.includes('B_NEW_1 -->'));
  await assertEditorSourceIsSavedAndValid();
});

test('test_insert_decision_after_splices_blocks_and_choices_with_one_terminal_branch', async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_A --> B_B\n  B_B --> B_C');
  await clickNode('B_B');
  await clickInspectorAction('insert-decision-after');
  let source = await evaluate('codeBox.value');
  assert.ok(source.includes('B_A --> B_B'));
  assert.ok(source.includes('B_B --> Q_NEW_1'));
  assert.ok(source.includes('Q_NEW_1{"New Decision"}'));
  assert.ok(source.includes('Q_CHOICE_NEW_1_Y["Yes"]'));
  assert.ok(source.includes('Q_CHOICE_NEW_1_N["No"]'));
  assert.ok(source.includes('Q_NEW_1 --> Q_CHOICE_NEW_1_Y'));
  assert.ok(source.includes('Q_NEW_1 --> Q_CHOICE_NEW_1_N'));
  assert.ok(source.includes('Q_CHOICE_NEW_1_Y --> B_C'));
  assert.ok(!source.includes('Q_CHOICE_NEW_1_N -->'));
  assert.ok(!source.includes('B_B --> B_C'));
  await assertEditorSourceIsSavedAndValid();

  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  Q_PICK{"Q"}\n  Q_CHOICE_PICK_A["A"]\n  B_C["C"]\n  Q_PICK --> Q_CHOICE_PICK_A\n  Q_CHOICE_PICK_A --> B_C');
  await clickNode('Q_CHOICE_PICK_A');
  await clickInspectorAction('insert-decision-after');
  source = await evaluate('codeBox.value');
  assert.ok(source.includes('Q_PICK --> Q_CHOICE_PICK_A'));
  assert.ok(source.includes('Q_CHOICE_PICK_A --> Q_NEW_1'));
  assert.ok(source.includes('Q_CHOICE_NEW_1_Y --> B_C'));
  assert.ok(!source.includes('Q_CHOICE_NEW_1_N -->'));
  assert.ok(!source.includes('Q_CHOICE_PICK_A --> B_C'));
  await assertEditorSourceIsSavedAndValid();
});

test('test_insert_decision_after_a_terminal_node_creates_two_terminal_choices', async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_A["A"]');
  await clickNode('B_A');
  await clickInspectorAction('insert-decision-after');
  const source = await evaluate('codeBox.value');
  assert.ok(source.includes('B_A --> Q_NEW_1'));
  assert.ok(source.includes('Q_NEW_1 --> Q_CHOICE_NEW_1_Y'));
  assert.ok(source.includes('Q_NEW_1 --> Q_CHOICE_NEW_1_N'));
  assert.ok(!source.includes('Q_CHOICE_NEW_1_Y -->'));
  assert.ok(!source.includes('Q_CHOICE_NEW_1_N -->'));
  await assertEditorSourceIsSavedAndValid();
});

test('test_new_static_text_enter_keeps_selection_and_focuses_destination', async () => {
  await resetEditorFixture();
  await clickNode('B_LetGo');
  await chooseDestination('new-static');
  await evaluate(`(() => { const input = document.getElementById('nodeTextInput'); input.value = 'Follow up'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
  await evaluate('window.editorActionPromise');
  assert.ok((await evaluate('codeBox.value')).includes('B_NEW_1["Follow up"]'));
  assert.deepEqual(await inspectorFocus(), { activeId: 'destinationSelect', selectedId: 'B_NEW_1' });
  await assertEditorSourceIsSavedAndValid();
});
