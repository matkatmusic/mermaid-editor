import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { dispatchNodeClick, openEditorDrawer, resetEditorFixture } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const PUZZLE_SOLVER_RULES = readFileSync(join(import.meta.dirname, "puzzle-solver-rules-phone.fixture.mmd"), "utf8");

async function listPhoneNodeIds(): Promise<string[]> {
  return executeExpression("JSON.stringify([...document.querySelectorAll('#phoneDiagram [data-node-id]')].map(el => el.dataset.nodeId))").then(JSON.parse);
}

async function listPhoneChoiceButtonIds(): Promise<string[]> {
  return executeExpression("JSON.stringify([...document.querySelectorAll('#phoneDiagram button[data-choose]')].map(button => button.dataset.choose))").then(JSON.parse);
}

test('test_phone_choice_button_walks_a_decision_under_the_second_start_node', async () => {
  // Scenario: the file has two start nodes (Q_INSIDE_REPO_AT_START and B_LAUNCH); the phone shows a decision under B_LAUNCH.
  await resetEditorFixture();
  await executeExpression("window.capturedErrors = []; window.addEventListener('error', (event) => window.capturedErrors.push(String(event.message))); window.addEventListener('unhandledrejection', (event) => window.capturedErrors.push('rejection: ' + String(event.reason && event.reason.message || event.reason)));");
  await executeExpression(`showOpenedFile('/tmp/puzzle-solver-rules.mmd', ${JSON.stringify(PUZZLE_SOLVER_RULES)})`);
  await waitMilliseconds(1000);
  // Step: pick the decision that follows B_LAUNCH in the main view; the phone shows the B_LAUNCH slice with its choice buttons.
  await dispatchNodeClick('Q_JSONLS_GIVEN');
  await waitMilliseconds(1000);
  assert.ok((await listPhoneNodeIds()).includes('B_LAUNCH'));
  const buttonIds = await listPhoneChoiceButtonIds();
  assert.ok(buttonIds.length > 0, 'the phone shows at least one choice button');
  // Step: press the first choice button; the answer joins the path and the phone walks from B_LAUNCH.
  await executeExpression(`document.querySelector('#phoneDiagram button[data-choose="${buttonIds[0]}"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
  await waitMilliseconds(1000);
  // The fake file path /tmp/... is not the server's opened file, so its autosave error ("No file opened") is expected and ignored.
  const phoneErrors: string[] = await executeExpression("JSON.stringify(window.capturedErrors.filter(message => !message.includes('No file opened')))").then(JSON.parse);
  assert.deepEqual(phoneErrors, []);
  assert.deepEqual(await executeExpression("JSON.stringify(phonePath)").then(JSON.parse), [buttonIds[0]]);
  assert.ok((await listPhoneNodeIds()).includes('B_LAUNCH'));
});
