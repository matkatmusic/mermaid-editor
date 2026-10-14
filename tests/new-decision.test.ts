import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { evaluate } from "./cdp.ts";
import { assertEditorSourceIsSavedAndValid, clickNode, openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { chooseDestination, clickInspectorAction, inspectorFocus, inspectorState } from "./inspector-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test('test_new_decision_button_and_destination_option_have_identical_source_and_initial_focus', async () => {
  const fixture = 'flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_D["D"]\n  B_A --> B_B --> B_C --> B_D';
  await resetEditorFixture();
  await setEditorSource(fixture);
  await clickNode('B_B');
  const buttonHistoryLength = await evaluate('editorHistory.length');
  await clickInspectorAction('add-decision-after');
  const buttonSource = await evaluate('codeBox.value');
  assert.ok(buttonSource.includes('B_A --> B_B'));
  assert.ok(buttonSource.includes('B_B --> Q_NEW_1'));
  assert.ok(buttonSource.includes('Q_NEW_1{"New Decision"}'));
  assert.ok(buttonSource.includes('Q_CHOICE_NEW_1_Y["Yes"]'));
  assert.ok(buttonSource.includes('Q_CHOICE_NEW_1_N["No"]'));
  assert.ok(buttonSource.includes('Q_NEW_1 --> Q_CHOICE_NEW_1_Y'));
  assert.ok(buttonSource.includes('Q_NEW_1 --> Q_CHOICE_NEW_1_N'));
  assert.ok(buttonSource.includes('Q_CHOICE_NEW_1_Y --> B_C'));
  assert.ok(!buttonSource.includes('Q_CHOICE_NEW_1_N -->'));
  assert.ok(buttonSource.includes('B_C --> B_D'));
  assert.ok(!buttonSource.includes('B_B --> B_C'));
  assert.deepEqual(await inspectorFocus(), { activeId: 'nodeTextInput', selectedId: 'Q_NEW_1' });
  assert.equal(await evaluate('editorHistory.length'), buttonHistoryLength + 1);
  await assertEditorSourceIsSavedAndValid();

  await resetEditorFixture();
  await setEditorSource(fixture);
  await clickNode('B_B');
  await chooseDestination('new-decision');
  assert.equal(await evaluate('codeBox.value'), buttonSource);
  assert.deepEqual(await inspectorFocus(), { activeId: 'nodeTextInput', selectedId: 'Q_NEW_1' });
  await assertEditorSourceIsSavedAndValid();
});

test('test_new_decision_text_enter_commits_the_new_decision', async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_START["Start"]');
  await clickNode('B_START');
  await chooseDestination('new-decision');
  const historyBeforeText = await evaluate('editorHistory.length');
  await evaluate(`(() => { const input = document.getElementById('nodeTextInput'); input.value = 'Decide next'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
  await evaluate('window.editorActionPromise');
  const source = await evaluate('codeBox.value');
  assert.ok(source.includes('Q_NEW_1{"Decide next"}'));
  assert.ok(source.includes('Q_NEW_1 --> Q_CHOICE_NEW_1_Y'));
  assert.ok(source.includes('Q_NEW_1 --> Q_CHOICE_NEW_1_N'));
  assert.equal(await evaluate('editorHistory.length'), historyBeforeText + 1);
  await assertEditorSourceIsSavedAndValid();
});

test('test_add_choice_on_inspector_appends_a_new_terminal_choice_without_touching_existing_edges', async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  Q_Q{"Q"}\n  Q_CHOICE_Q_A["A"]\n  B_END["End"]\n  Q_Q --> Q_CHOICE_Q_A\n  Q_CHOICE_Q_A --> B_END');
  await clickNode('Q_Q');
  const beforeCount = await evaluate('editorGraph().edges.filter(e => e.from === "Q_Q").length');
  await clickInspectorAction('add-choice');
  const source = await evaluate('codeBox.value');
  // Step: a brand-new terminal choice is appended, growing Q's branch count by one.
  assert.ok(source.includes('Q_CHOICE_Q_NEW["New choice"]'));
  assert.ok(source.includes('Q_Q --> Q_CHOICE_Q_NEW'));
  assert.ok(!source.includes('Q_CHOICE_Q_NEW -->'));
  // Step: the existing explicit choice is untouched.
  assert.ok(source.includes('Q_Q --> Q_CHOICE_Q_A'));
  assert.ok(source.includes('Q_CHOICE_Q_A["A"]'));
  assert.ok(source.includes('Q_CHOICE_Q_A --> B_END'));
  const afterCount = await evaluate('editorGraph().edges.filter(e => e.from === "Q_Q").length');
  assert.equal(afterCount, beforeCount + 1);
  await assertEditorSourceIsSavedAndValid();
});

test('test_add_choice_on_inspector_keeps_the_original_decision_selected', async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_START["Start"]\n  Q_DECISION{"Q"}\n  Q_CHOICE_DECISION_YES["Yes"]\n  B_END["End"]\n  B_START --> Q_DECISION\n  Q_DECISION --> Q_CHOICE_DECISION_YES\n  Q_CHOICE_DECISION_YES --> B_END');
  await clickNode('Q_DECISION');
  const historyBefore = await evaluate('editorHistory.length');
  await clickInspectorAction('add-choice');
  // Step: the inspector remains on the decision; the new choice is not selected or focused.
  const state = await inspectorState();
  assert.equal(state.hidden, false);
  assert.equal(state.title, 'Decision block');
  assert.equal(state.text, 'Q');
  assert.deepEqual(await inspectorFocus(), { activeId: '', selectedId: 'Q_DECISION' });
  const source = await evaluate('codeBox.value');
  assert.ok(source.includes('Q_CHOICE_DECISION_NEW["New choice"]'));
  assert.ok(source.includes('Q_DECISION --> Q_CHOICE_DECISION_NEW'));
  // Step: the add-choice commit is exactly one new undo entry.
  assert.equal(await evaluate('editorHistory.length'), historyBefore + 1);
});
