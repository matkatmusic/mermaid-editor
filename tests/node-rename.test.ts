import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse, KeyName, pressKey } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const MOOD_SOURCE = [
  "flowchart TD",
  '  B_START["Start"]',
  '  Q_MOOD{"Mood?"}',
  '  Q_MOODY{"Moody?"}',
  '  Q_CHOICE_MOOD_GOOD["Good"]',
  '  Q_CHOICE_MOOD_BAD["Bad"]',
  '  Q_CHOICE_MOODY_YES["Yes"]',
  '  Q_CHOICE_MOODY_NO["No"]',
  '  B_END["End"]',
  "  B_START --> Q_MOOD",
  "  Q_MOOD --> Q_CHOICE_MOOD_GOOD --> Q_MOODY",
  "  Q_MOOD --> Q_CHOICE_MOOD_BAD --> B_END",
  "  Q_MOODY --> Q_CHOICE_MOODY_YES --> B_END",
  "  Q_MOODY --> Q_CHOICE_MOODY_NO --> B_END",
  "  classDef question fill:#fff",
  "  class Q_MOOD,Q_MOODY question",
].join("\n");

async function openSourceAndSelect(source: string, id: string) {
  await resetEditorFixture();
  await setEditorSource(source);
  await waitMilliseconds(500);
  await clickNodeWithMouse(id);
  await waitMilliseconds(300);
}

async function typeNameKeyByKey(name: string) {
  // Scenario: real keystrokes in the Node Name box: select the old name, then type over it.
  await executeExpression("(() => { const input = document.getElementById('nodeNameInput'); input.focus(); input.select(); })()");
  if (name === "")
    await pressKey(KeyName.Backspace);
  for (const character of name)
    await send("Input.dispatchKeyEvent", { type: "char", text: character, key: character });
}

async function typeNameThenPress(name: string, key: typeof KeyName.Tab | typeof KeyName.Enter) {
  await typeNameKeyByKey(name);
  await pressKey(key);
  await executeExpression("window.editorActionPromise");
  await waitMilliseconds(500);
}

async function readSource(): Promise<string> {
  return executeExpression("codeBox.value");
}

async function readCheck(): Promise<string> {
  return executeExpression("document.getElementById('nodeNameCheck').textContent");
}

async function readKindRow() {
  return executeExpression(`JSON.stringify({
    static: document.getElementById('nodeKindStatic').checked,
    question: document.getElementById('nodeKindQuestion').checked,
    choice: document.getElementById('nodeKindChoice').checked,
    disabled: ['nodeKindStatic', 'nodeKindQuestion', 'nodeKindChoice'].every((id) => document.getElementById(id).disabled),
    parent: document.getElementById('nodeParentLabel').textContent.trim(),
  })`).then(JSON.parse);
}

function countWholeWord(source: string, word: string) {
  return (source.match(new RegExp(`(?<![A-Za-z0-9_])${word}(?![A-Za-z0-9_])`, "g")) ?? []).length;
}

test("test_type_row_checks_the_kind_of_the_selected_node_and_names_the_parent_of_a_choice", async () => {
  await openSourceAndSelect(MOOD_SOURCE, "B_END");
  assert.deepEqual(await readKindRow(), { static: true, question: false, choice: false, disabled: true, parent: "" });
  await clickNodeWithMouse("Q_MOOD");
  assert.deepEqual(await readKindRow(), { static: false, question: true, choice: false, disabled: true, parent: "" });
  await clickNodeWithMouse("Q_CHOICE_MOOD_GOOD");
  assert.deepEqual(await readKindRow(), { static: false, question: false, choice: true, disabled: true, parent: "- parent: Q_MOOD" });
});

test("test_node_name_box_shows_the_name_without_the_prefix_and_the_checker_shows_the_full_id", async () => {
  await openSourceAndSelect(MOOD_SOURCE, "B_END");
  assert.equal(await executeExpression("document.getElementById('nodeNameInput').value"), "END");
  assert.equal(await readCheck(), "result: B_END");
  await clickNodeWithMouse("Q_MOOD");
  assert.equal(await executeExpression("document.getElementById('nodeNameInput').value"), "MOOD");
  assert.equal(await readCheck(), "result: Q_MOOD");
  await clickNodeWithMouse("Q_CHOICE_MOOD_GOOD");
  assert.equal(await executeExpression("document.getElementById('nodeNameInput').value"), "GOOD");
  assert.equal(await readCheck(), "result: Q_CHOICE_MOOD_GOOD");
});

test("test_a_choice_id_without_the_parent_prefix_shows_everything_after_q_choice", async () => {
  await openSourceAndSelect(MOOD_SOURCE.replaceAll("Q_CHOICE_MOODY_NO", "Q_CHOICE_ZED_GOOD"), "Q_CHOICE_ZED_GOOD");
  assert.equal(await executeExpression("document.getElementById('nodeNameInput').value"), "ZED_GOOD");
});

test("test_a_choice_without_a_parent_question_shows_parent_none_and_uses_the_plain_prefix", async () => {
  const source = ["flowchart TD", '  B_START["Start"]', '  Q_CHOICE_LONE["Lone"]', '  B_END["End"]', "  B_START --> Q_CHOICE_LONE --> B_END"].join("\n");
  await openSourceAndSelect(source, "Q_CHOICE_LONE");
  assert.equal((await readKindRow()).parent, "parent: none");
  assert.equal(await executeExpression("document.getElementById('nodeNameInput').value"), "LONE");
  await typeNameThenPress("ALONE", KeyName.Tab);
  assert.ok((await readSource()).includes('  Q_CHOICE_ALONE["Lone"]'));
});

test("test_checker_updates_on_every_key_stroke", async () => {
  await openSourceAndSelect(MOOD_SOURCE, "Q_MOOD");
  await typeNameKeyByKey("FEEL");
  assert.equal(await readCheck(), "result: Q_FEEL");
  await typeNameKeyByKey("A-B.C");
  assert.equal(await readCheck(), "error: node names cannot contain -, .");
  await typeNameKeyByKey("");
  assert.equal(await readCheck(), "error: node name cannot be empty");
  await typeNameKeyByKey("MOODY");
  assert.equal(await readCheck(), "error: Q_MOODY is already used");
});

test("test_real_tab_renames_a_block_everywhere_in_one_undo_step_and_keeps_it_selected", async () => {
  await openSourceAndSelect(MOOD_SOURCE, "B_END");
  const historyBefore = await executeExpression("editorHistory.length");
  await typeNameThenPress("FINISH", KeyName.Tab);
  const source = await readSource();
  assert.equal(countWholeWord(source, "B_END"), 0);
  assert.equal(countWholeWord(source, "B_FINISH"), 1 + 3 + 1);
  assert.ok(source.includes('"lastSelectedNodeId":"B_FINISH"'));
  assert.equal(await executeExpression("selectedEditorNodeId"), "B_FINISH");
  assert.equal(await executeExpression("document.getElementById('nodeNameInput').value"), "FINISH");
  assert.equal(await executeExpression("editorHistory.length"), historyBefore + 1);
});

test("test_real_enter_renames_a_question_and_its_choices_but_not_longer_names", async () => {
  await openSourceAndSelect(MOOD_SOURCE, "Q_MOOD");
  await typeNameThenPress("FEEL", KeyName.Enter);
  const source = await readSource();
  assert.equal(countWholeWord(source, "Q_MOOD"), 0);
  assert.equal(countWholeWord(source, "Q_CHOICE_MOOD_GOOD"), 0);
  assert.equal(countWholeWord(source, "Q_CHOICE_MOOD_BAD"), 0);
  assert.ok(source.includes('  Q_FEEL{"Mood?"}'));
  assert.equal(countWholeWord(source, "Q_CHOICE_FEEL_GOOD"), 2);
  assert.equal(countWholeWord(source, "Q_CHOICE_FEEL_BAD"), 2);
  assert.ok(source.includes("  class Q_FEEL,Q_MOODY question"));
  assert.equal(countWholeWord(source, "Q_MOODY"), 5);
  assert.equal(await executeExpression("selectedEditorNodeId"), "Q_FEEL");
});

test("test_renaming_a_choice_adds_the_parent_name_and_renames_only_that_choice", async () => {
  await openSourceAndSelect(MOOD_SOURCE, "Q_CHOICE_MOOD_GOOD");
  await typeNameThenPress("FINE", KeyName.Tab);
  const source = await readSource();
  assert.equal(countWholeWord(source, "Q_CHOICE_MOOD_GOOD"), 0);
  assert.equal(countWholeWord(source, "Q_CHOICE_MOOD_FINE"), 2 + 1);
  assert.equal(countWholeWord(source, "Q_MOOD"), 5);
});

async function assertRenameRejected(typedName: string, expectedCheck: string, source: string = MOOD_SOURCE) {
  await openSourceAndSelect(source, "Q_MOOD");
  const before = await readSource();
  const historyBefore = await executeExpression("editorHistory.length");
  await typeNameThenPress(typedName, KeyName.Tab);
  assert.equal(await readSource(), before);
  assert.equal(await executeExpression("editorHistory.length"), historyBefore);
  assert.equal(await executeExpression("document.getElementById('nodeNameInput').value"), "MOOD");
  assert.equal(await executeExpression("selectedEditorNodeId"), "Q_MOOD");
  assert.equal(await readCheck(), expectedCheck);
}

test("test_rename_to_an_empty_name_is_rejected_and_the_error_stays", async () => {
  await assertRenameRejected("", "error: node name cannot be empty");
});

test("test_rename_with_illegal_characters_is_rejected_and_the_error_stays", async () => {
  await assertRenameRejected("MO-O.D", "error: node names cannot contain -, .");
});

test("test_rename_to_a_name_already_used_is_rejected", async () => {
  await assertRenameRejected("MOODY", "error: Q_MOODY is already used");
});

test("test_rename_whose_choice_cascade_would_use_a_name_already_used_is_rejected", async () => {
  await assertRenameRejected("ZED", "error: The identifier Q_CHOICE_ZED_GOOD is already used.", MOOD_SOURCE.replaceAll("Q_CHOICE_MOODY_NO", "Q_CHOICE_ZED_GOOD"));
});

test("test_click_away_from_node_name_applies_the_rename", async () => {
  await openSourceAndSelect(MOOD_SOURCE, "B_END");
  await typeNameKeyByKey("FINISH");
  await clickNodeWithMouse("B_START");
  await executeExpression("window.editorActionPromise");
  await waitMilliseconds(800);
  const source = await readSource();
  assert.equal(countWholeWord(source, "B_END"), 0);
  assert.equal(countWholeWord(source, "B_FINISH"), 4);
});
