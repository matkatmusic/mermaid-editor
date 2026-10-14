import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { evaluate } from "./cdp.ts";
import { assertEditorSourceIsSavedAndValid, clickNode, openEditorDrawer, resetEditorFixture, runEditorAction, selectEditorNode, setEditorSource } from "./editor-helpers.ts";
import { chooseDestination, destinationRender, destinationState } from "./inspector-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test("test_destination_lists_terminal_then_unique_static_and_decision_nodes_in_source_order", async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_START["Start"]\n  Q_DECISION{"Decide"}\n  Q_CHOICE_DECISION_Y["Yes"]\n  B_LATER["Later"]\n  B_START --> Q_DECISION\n  Q_DECISION --> Q_CHOICE_DECISION_Y\n  Q_CHOICE_DECISION_Y --> B_LATER\n  B_LATER --> Q_DECISION');
  await clickNode('Q_CHOICE_DECISION_Y');
  assert.deepEqual((await destinationState()).options, [
    { value: '', text: 'Terminal' },
    { value: 'new-static', text: 'New static block' },
    { value: 'new-decision', text: 'New Decision block' },
    { value: 'B_START', text: 'Start (B_START)' },
    { value: 'Q_DECISION', text: 'Decide (Q_DECISION)' },
    { value: 'B_LATER', text: 'Later (B_LATER)' },
  ]);
});

test("test_destination_is_hidden_for_decisions_and_close_tracks_terminal_static_or_choice", async () => {
  await resetEditorFixture();
  await clickNode('Q_Q1');
  assert.equal((await destinationState()).hidden, true);
  await clickNode('B_LetGo');
  assert.equal((await destinationState()).dismiss, 'Close');
  await clickNode('Q_CHOICE_Q1_NEW2');
  assert.equal((await destinationState()).dismiss, 'Cancel');
});

test("test_destination_row_is_rendered_for_choice_and_static_nodes_but_not_for_decision_nodes", async () => {
  await resetEditorFixture();
  // Selecting a choice node with an explicit destination paints and labels the row with a populated menu.
  await clickNode('Q_CHOICE_Q1_NEW2');
  let render = await destinationRender();
  assert.notEqual(render.display, 'none');
  assert.equal(render.labelText, 'Destination:');
  assert.ok(render.optionCount > 0);
  // Step: select the LetGo static block; the destination row is painted, labelled, and its menu is populated.
  await clickNode('B_LetGo');
  render = await destinationRender();
  assert.notEqual(render.display, 'none');
  assert.equal(render.labelText, 'Destination:');
  assert.ok(render.optionCount > 0);
  // Step: select the Q1 decision node; the destination row is not painted and its menu is empty.
  await clickNode('Q_Q1');
  render = await destinationRender();
  assert.equal(render.display, 'none');
  assert.equal(render.optionCount, 0);
});

test("test_destination_replaces_an_outgoing_edge_and_keeps_the_old_path_as_an_orphan", async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  Q_D{"D"}\n  B_A --> B_B\n  B_B --> B_C\n  B_C --> Q_D');
  await clickNode('B_A');
  await chooseDestination('B_C');
  const source = await evaluate('codeBox.value');
  assert.ok(source.includes('B_A --> B_C'));
  assert.ok(!source.includes('B_A --> B_B'));
  assert.ok(source.includes('B_B["B"]'));
  assert.ok(source.includes('B_B --> B_C'));
  await assertEditorSourceIsSavedAndValid();
});

test("test_destination_terminal_removes_only_the_selected_outgoing_edge", async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_A --> B_B\n  B_B --> B_C');
  await clickNode('B_A');
  await chooseDestination('');
  const source = await evaluate('codeBox.value');
  assert.ok(!source.includes('B_A --> B_B'));
  assert.ok(source.includes('B_A["A"]'));
  assert.ok(source.includes('B_B["B"]'));
  assert.ok(source.includes('B_B --> B_C'));
  await clickNode('B_A');
  assert.equal((await destinationState()).dismiss, 'Close');
  await assertEditorSourceIsSavedAndValid();
});

test("test_destination_accepts_descendants_and_current_value_is_a_no_op", async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_A --> B_B\n  B_B --> B_C');
  await clickNode('B_A');
  const current = await evaluate('codeBox.value');
  await chooseDestination('B_B');
  assert.equal(await evaluate('codeBox.value'), current);
  await chooseDestination('B_C');
  await clickNode('B_C');
  await chooseDestination('B_A');
  assert.ok((await evaluate('codeBox.value')).includes('B_C --> B_A'));
  await assertEditorSourceIsSavedAndValid();
});

test("test_insert_static_before_splices_a_chained_edge_line", async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_A --> B_B --> B_C');
  // Step: select the middle node of a one-line A --> B --> C chain.
  await selectEditorNode('B_B');
  await runEditorAction('insertStaticBefore');
  const updated = await evaluate('codeBox.value');
  // Step: only A --> B is replaced; B --> C is retained and the new node is connected.
  assert.ok(updated.includes('B_A --> B_NEW_1'));
  assert.ok(updated.includes('B_NEW_1 --> B_B'));
  assert.ok(updated.includes('B_B --> B_C'));
  assert.ok(!updated.includes('B_A --> B_B --> B_C'));
  // Step: the rendered graph contains the complete connected path, not an orphaned new node.
  for (const id of ['B_A', 'B_NEW_1', 'B_B', 'B_C'])
    assert.equal(await evaluate(`!!document.querySelector('[id*="flowchart-${id}-"]')`), true);
  await assertEditorSourceIsSavedAndValid();
});

test("test_dirty_text_then_destination_creates_two_ordered_undo_entries", async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_A["A"]\n  B_B["B"]\n  Q_C{"C"}\n  B_A --> B_B\n  B_B --> Q_C');
  await clickNode('B_A');
  await evaluate("document.getElementById('nodeTextInput').value = 'Renamed A'");
  await chooseDestination('Q_C');
  let source = await evaluate('codeBox.value');
  assert.ok(source.includes('B_A["Renamed A"]'));
  assert.ok(source.includes('B_A --> Q_C'));
  await evaluate('window.undoEditorAction(); window.editorActionPromise');
  source = await evaluate('codeBox.value');
  assert.ok(source.includes('B_A["Renamed A"]'));
  assert.ok(source.includes('B_A --> B_B'));
  await evaluate('window.undoEditorAction(); window.editorActionPromise');
  source = await evaluate('codeBox.value');
  assert.ok(source.includes('B_A["A"]'));
  assert.ok(source.includes('B_A --> B_B'));
  await assertEditorSourceIsSavedAndValid();
});
