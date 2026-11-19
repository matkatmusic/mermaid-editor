import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { dispatchNodeClick, openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { inspectorFocus } from "./inspector-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const THREE_BLOCKS = 'flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_A --> B_B';

async function dispatchShiftClick(id: string) {
  await executeExpression(`document.querySelector('[id*="flowchart-${id}-"]').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))`);
  await waitMilliseconds(500);
}

test('test_shift_click_two_nodes_adds_an_edge_from_the_first_to_the_second', async () => {
  // Scenario: B_A already has an edge; shift-click B_C then B_A adds B_C --> B_A and keeps B_A --> B_B.
  await resetEditorFixture();
  await setEditorSource(THREE_BLOCKS);
  await dispatchShiftClick('B_C');
  await dispatchShiftClick('B_A');
  const source: string = await executeExpression('codeBox.value');
  assert.ok(source.includes('B_C --> B_A'));
  assert.ok(!source.includes('B_A --> B_C'));
  assert.ok(source.includes('B_A --> B_B'));
});

test('test_shift_click_one_node_selects_it_and_adds_no_edge', async () => {
  await resetEditorFixture();
  await setEditorSource(THREE_BLOCKS);
  await dispatchShiftClick('B_C');
  assert.equal((await inspectorFocus()).selectedId, 'B_C');
  const source: string = await executeExpression('codeBox.value');
  assert.ok(!source.includes('B_C -->'));
});

test('test_plain_click_between_two_shift_clicks_cancels_the_connection', async () => {
  await resetEditorFixture();
  await setEditorSource(THREE_BLOCKS);
  await dispatchShiftClick('B_C');
  await dispatchNodeClick('B_B');
  await dispatchShiftClick('B_A');
  const source: string = await executeExpression('codeBox.value');
  assert.ok(!source.includes('B_C --> B_A'));
});
