import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse, KeyName, Modifier, pressKey } from "../../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const THREE_BLOCKS = 'flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_A --> B_B\n  B_B --> B_C';

async function readEditorSource(): Promise<string> {
  return executeExpression("codeBox.value");
}

// Leaves the editor with B_B removed and the earlier source in the undo history.
async function startAfterRemovingB() {
  await resetEditorFixture();
  await setEditorSource(THREE_BLOCKS);
  await clickNodeWithMouse("B_B");
  await pressKey(KeyName.Delete);
  assert.ok(!(await readEditorSource()).includes("B_B"));
}

test("test_cmd_z_undoes_the_last_edit", async () => {
  await startAfterRemovingB();
  await pressKey(KeyName.Z, Modifier.Meta);
  assert.ok((await readEditorSource()).includes("B_B"));
});

test("test_cmd_shift_z_redoes_the_undone_edit", async () => {
  await startAfterRemovingB();
  await pressKey(KeyName.Z, Modifier.Meta);
  await pressKey(KeyName.UpperZ, Modifier.Meta | Modifier.Shift);
  assert.ok(!(await readEditorSource()).includes("B_B"));
});

test("test_cmd_z_does_nothing_in_the_app_while_focus_is_in_a_text_box", async () => {
  await startAfterRemovingB();
  await executeExpression("document.getElementById('nodeTextInput').focus()");
  await pressKey(KeyName.Z, Modifier.Meta);
  assert.ok(!(await readEditorSource()).includes("B_B"));
});

test("test_cmd_z_calls_preventDefault_only_when_the_app_handles_the_key", async () => {
  await startAfterRemovingB();
  await executeExpression("window.defaultPreventedKeys = []; document.addEventListener('keydown', (event) => window.defaultPreventedKeys.push(event.defaultPrevented), false)");
  await pressKey(KeyName.Z, Modifier.Meta);
  await executeExpression("document.getElementById('nodeTextInput').focus()");
  await pressKey(KeyName.Z, Modifier.Meta);
  assert.deepEqual(await executeExpression("window.defaultPreventedKeys"), [true, false]);
});
