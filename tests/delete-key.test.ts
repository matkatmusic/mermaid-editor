import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse, KeyName, Modifier, pressKey } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const FOUR_BLOCKS = 'flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_D["D"]\n  B_A --> B_B\n  B_B --> B_C\n  B_C --> B_D';
const ONE_QUESTION = 'flowchart TD\n  B_START["Start"]\n  Q_ASK{"Ask"}\n  Q_CHOICE_ASK_YES["Yes"]\n  Q_CHOICE_ASK_NO["No"]\n  B_YES["Yes end"]\n  B_NO["No end"]\n  B_START --> Q_ASK\n  Q_ASK --> Q_CHOICE_ASK_YES --> B_YES\n  Q_ASK --> Q_CHOICE_ASK_NO --> B_NO';

async function startDeleteTest(source: string) {
  await resetEditorFixture();
  await setEditorSource(source);
}

async function readEditorSource(): Promise<string> {
  return executeExpression("codeBox.value");
}

test("test_delete_key_removes_the_single_selected_block", async () => {
  await startDeleteTest(FOUR_BLOCKS);
  await clickNodeWithMouse("B_B");
  await pressKey(KeyName.Delete);
  const source = await readEditorSource();
  assert.ok(!source.includes("B_B"));
  assert.ok(source.includes("B_A --> B_C"));
});

test("test_backspace_key_removes_the_single_selected_block", async () => {
  await startDeleteTest(FOUR_BLOCKS);
  await clickNodeWithMouse("B_B");
  await pressKey(KeyName.Backspace);
  assert.ok(!(await readEditorSource()).includes("B_B"));
});

test("test_delete_key_removes_every_selected_block_as_one_undo_step", async () => {
  await startDeleteTest(FOUR_BLOCKS);
  await clickNodeWithMouse("B_B");
  await clickNodeWithMouse("B_C", Modifier.Meta);
  const historyLengthBefore: number = await executeExpression("editorHistory.length");
  await pressKey(KeyName.Delete);
  const source = await readEditorSource();
  assert.ok(!source.includes("B_B"));
  assert.ok(!source.includes("B_C"));
  assert.ok(source.includes("B_A --> B_D"));
  assert.equal(await executeExpression("editorHistory.length"), historyLengthBefore + 1);
});

test("test_delete_key_removes_a_question_and_keeps_the_path_of_its_first_choice", async () => {
  await startDeleteTest(ONE_QUESTION);
  await clickNodeWithMouse("Q_ASK");
  await pressKey(KeyName.Delete);
  const source = await readEditorSource();
  assert.ok(!source.includes("Q_ASK"));
  assert.ok(source.includes("B_START --> B_YES"));
  assert.ok(!source.includes("B_START --> B_NO"));
});

test("test_delete_key_does_nothing_while_focus_is_in_the_node_text_input", async () => {
  await startDeleteTest(FOUR_BLOCKS);
  await clickNodeWithMouse("B_B");
  await executeExpression("document.getElementById('nodeTextInput').focus()");
  await pressKey(KeyName.Delete);
  assert.ok((await readEditorSource()).includes("B_B"));
});

test("test_delete_key_does_nothing_while_focus_is_outside_the_diagram_view", async () => {
  await startDeleteTest(FOUR_BLOCKS);
  await clickNodeWithMouse("B_B");
  await executeExpression("document.getElementById('editorUndoBtn').focus()");
  await pressKey(KeyName.Delete);
  assert.ok((await readEditorSource()).includes("B_B"));
});

test("test_delete_key_does_nothing_while_focus_is_in_the_source_editor", async () => {
  await startDeleteTest(FOUR_BLOCKS);
  await clickNodeWithMouse("B_B");
  await executeExpression("codeBox.focus()");
  await pressKey(KeyName.Delete);
  assert.ok((await readEditorSource()).includes("B_B"));
});
