import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { selectEditorNode } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url);

test("test_walk_back_button_selects_the_parent_and_asks_when_there_are_several", async () => {
  // Scenario: B_MID has one parent; B_END has two, so the modal lists them in edge order.
  const source = [
    "flowchart TD",
    '  B_START["Start"]',
    '  Q_ASK{"Pick?"}',
    '  Q_CHOICE_ASK_A["A"]',
    '  Q_CHOICE_ASK_B["B"]',
    '  B_MID["Mid"]',
    '  B_END["End"]',
    "  B_START --> Q_ASK",
    "  Q_ASK --> Q_CHOICE_ASK_A",
    "  Q_ASK --> Q_CHOICE_ASK_B",
    "  Q_CHOICE_ASK_A --> B_MID",
    "  Q_CHOICE_ASK_B --> B_END",
    "  B_MID --> B_END",
    "",
  ].join("\n");
  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/walk-back-demo.mmd`, { method: "PUT", body: source });
  await executeExpression("loadDiagram('walk-back-demo.mmd')");
  await waitMilliseconds(500);
  // Step: one parent, so the click selects it with no modal.
  await selectEditorNode("B_MID");
  await executeExpression("document.getElementById('walkBackBtn').click()");
  assert.equal(await executeExpression("selectedEditorNodeId"), "Q_CHOICE_ASK_A");
  assert.equal(await executeExpression("document.getElementById('walkBackDialog').open"), false);
  // Step: two parents, so the modal lists both as phone buttons and the second one is picked.
  await selectEditorNode("B_END");
  await executeExpression("document.getElementById('walkBackBtn').click()");
  assert.equal(await executeExpression("document.getElementById('walkBackDialog').open"), true);
  assert.equal(await executeExpression("document.querySelectorAll('#walkBackChoices .phone-choice').length"), 2);
  await executeExpression("document.querySelectorAll('#walkBackChoices .phone-choice')[1].click()");
  assert.equal(await executeExpression("document.getElementById('walkBackDialog').open"), false);
  assert.equal(await executeExpression("selectedEditorNodeId"), "B_MID");
  // Step: the root has no parent, so the button is disabled.
  await selectEditorNode("B_START");
  assert.equal(await executeExpression("document.getElementById('walkBackBtn').disabled"), true);
  // Step: put the default diagram back for later tests.
  await executeExpression("loadDiagram('accountability.mmd')");
  await waitMilliseconds(300);
});
