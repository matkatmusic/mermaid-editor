import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { dispatchNodeClick, openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickInspectorAction, inspectorFocus } from "./inspector-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const PUZZLE_SOLVER_RULES = readFileSync(join(import.meta.dirname, "puzzle-solver-rules.fixture.mmd"), "utf8");

async function measureOffsetFromPaneCenter(id: string): Promise<{ x: number; y: number }> {
  return executeExpression(`(() => {
    const output = document.getElementById('output');
    const pane = output.getBoundingClientRect();
    const node = document.querySelector('#diagram [id*="flowchart-${id}-"]').getBoundingClientRect();
    return {
      x: Math.abs(node.left + node.width / 2 - (pane.left + output.clientWidth / 2)),
      y: Math.abs(node.top + node.height / 2 - (pane.top + output.clientHeight / 2)),
    };
  })()`).then((value: unknown) => value as { x: number; y: number });
}

test('test_each_added_choice_is_centered_in_the_viewport', async () => {
  // Scenario: add a decision after a static block, then add six choices to it; each new choice is centered in #output.
  await resetEditorFixture();
  await setEditorSource(PUZZLE_SOLVER_RULES);
  await dispatchNodeClick('B_HISTORY_COMPLETE_IN_GIT');
  await clickInspectorAction('add-decision-after');
  await waitMilliseconds(500);
  const decisionId = (await inspectorFocus()).selectedId;
  const offsets: { id: string; x: number; y: number }[] = [];
  for (let choiceNumber = 1; choiceNumber <= 6; choiceNumber++) {
    await dispatchNodeClick(decisionId);
    await clickInspectorAction('add-choice');
    await waitMilliseconds(500);
    const choiceId = (await inspectorFocus()).selectedId;
    offsets.push({ id: choiceId, ...(await measureOffsetFromPaneCenter(choiceId)) });
  }
  console.log(JSON.stringify(offsets));
  for (const offset of offsets) {
    assert.ok(offset.x < 5, `${offset.id} x offset ${offset.x}`);
    assert.ok(offset.y < 5, `${offset.id} y offset ${offset.y}`);
  }
});
