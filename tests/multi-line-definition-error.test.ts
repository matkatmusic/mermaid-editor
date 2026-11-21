import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test("test_error_box_names_the_node_whose_definition_spans_more_than_one_line", async () => {
  // Scenario: the user pastes a label with a line break into the source editor.
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_A["a"]\n  B_LONG["first\nsecond"]\n  B_A --> B_LONG');
  // Step: the error box shows the real problem, not "must be declared on its own standalone line".
  const message: string = await executeExpression("document.getElementById('error').textContent");
  assert.ok(message.includes('Line 3: the definition of "B_LONG" must start and end on one line. Its text has a line break.'));
  assert.ok(!message.includes("standalone line"));
});
