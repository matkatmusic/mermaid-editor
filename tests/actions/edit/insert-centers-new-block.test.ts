import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression, waitMilliseconds } from "../../cdp.ts";
import { dispatchNodeClick, openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickInspectorAction } from "../../inspector-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const TALL_CHAIN = 'flowchart TD\n' + Array.from({ length: 14 }, (_, index) => `  B_${index + 1}["Block ${index + 1}"]`).join('\n') + '\n' + Array.from({ length: 13 }, (_, index) => `  B_${index + 1} --> B_${index + 2}`).join('\n');

async function measureVerticalOffsetFromPaneCenter(id: string): Promise<number> {
  return executeExpression(`(() => {
    const pane = document.getElementById('output').getBoundingClientRect();
    const node = document.querySelector('#diagram [id*="flowchart-${id}-"]').getBoundingClientRect();
    return Math.abs(node.top + node.height / 2 - (pane.top + pane.height / 2));
  })()`);
}

async function selectMiddleBlockAndScrollToTop() {
  await resetEditorFixture();
  await setEditorSource(TALL_CHAIN);
  await dispatchNodeClick('B_7');
  await executeExpression("document.getElementById('output').scrollTop = 0");
}

test('test_insert_static_block_after_centers_the_new_block_in_the_viewport', async () => {
  // Scenario: the new block is far from the top of the pane; the pane scrolls it to the center.
  await selectMiddleBlockAndScrollToTop();
  await clickInspectorAction('insert-static-after');
  await waitMilliseconds(500);
  assert.ok(await measureVerticalOffsetFromPaneCenter('B_NEW_1') < 5);
});

test('test_add_decision_block_after_centers_the_new_decision_in_the_viewport', async () => {
  await selectMiddleBlockAndScrollToTop();
  await clickInspectorAction('add-decision-after');
  await waitMilliseconds(500);
  assert.ok(await measureVerticalOffsetFromPaneCenter('Q_NEW_1') < 5);
});

test('test_insert_decision_and_leading_choice_before_centers_the_new_decision_in_the_viewport', async () => {
  await selectMiddleBlockAndScrollToTop();
  await clickInspectorAction('insert-decision-before');
  await waitMilliseconds(500);
  assert.ok(await measureVerticalOffsetFromPaneCenter('Q_NEW_1') < 5);
});
