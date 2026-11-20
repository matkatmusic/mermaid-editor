import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse, getHighlightedNodeIds, KeyName, Modifier, pressKey } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const THREE_BLOCKS = 'flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_A --> B_B\n  B_B --> B_C';

async function startMultiSelectTest() {
  await resetEditorFixture();
  await setEditorSource(THREE_BLOCKS);
}

test("test_cmd_click_adds_a_second_node_to_the_selection", async () => {
  await startMultiSelectTest();
  // Step: plain click B_A, then Cmd-click B_C.
  await clickNodeWithMouse("B_A");
  await clickNodeWithMouse("B_C", Modifier.Meta);
  // Step: both nodes carry the selection highlight.
  assert.deepEqual(await getHighlightedNodeIds(), ["B_A", "B_C"]);
});

test("test_cmd_click_on_a_selected_node_takes_it_out_of_the_selection", async () => {
  await startMultiSelectTest();
  await clickNodeWithMouse("B_A");
  await clickNodeWithMouse("B_B", Modifier.Meta);
  await clickNodeWithMouse("B_C", Modifier.Meta);
  // Step: Cmd-click B_B again; B_A and B_C stay selected.
  await clickNodeWithMouse("B_B", Modifier.Meta);
  assert.deepEqual(await getHighlightedNodeIds(), ["B_A", "B_C"]);
});

test("test_cmd_click_down_to_one_node_makes_it_the_single_selection", async () => {
  await startMultiSelectTest();
  await clickNodeWithMouse("B_A");
  await clickNodeWithMouse("B_B", Modifier.Meta);
  // Step: Cmd-click B_B again; only B_A is left and the inspector follows it.
  await clickNodeWithMouse("B_B", Modifier.Meta);
  assert.deepEqual(await getHighlightedNodeIds(), ["B_A"]);
  assert.equal(await executeExpression("selectedEditorNodeId"), "B_A");
});

test("test_plain_click_after_a_multi_selection_selects_only_that_node", async () => {
  await startMultiSelectTest();
  await clickNodeWithMouse("B_A");
  await clickNodeWithMouse("B_B", Modifier.Meta);
  await clickNodeWithMouse("B_C");
  assert.deepEqual(await getHighlightedNodeIds(), ["B_C"]);
  assert.equal(await executeExpression("selectedEditorNodeId"), "B_C");
});

test("test_node_inspector_is_empty_while_two_nodes_are_selected", async () => {
  await startMultiSelectTest();
  await clickNodeWithMouse("B_A");
  await clickNodeWithMouse("B_B", Modifier.Meta);
  assert.equal(await executeExpression("selectedEditorNodeId"), null);
});

test("test_escape_clears_the_whole_multi_selection", async () => {
  await startMultiSelectTest();
  await clickNodeWithMouse("B_A");
  await clickNodeWithMouse("B_B", Modifier.Meta);
  await pressKey(KeyName.Escape);
  assert.deepEqual(await getHighlightedNodeIds(), []);
});
