import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture } from "./editor-helpers.ts";
import { clickNodeWithMouse } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const TWO_START_NODES = readFileSync(join(import.meta.dirname, "puzzle-solver-rules-phone.fixture.mmd"), "utf8");
const START_PROMPT = "Select a starting node to walk a path through that diagram";
const ONE_START_NODE = [
  "flowchart TD",
  '  B_ONLY_START["Only start"]',
  '  Q_ONLY_ASK{"Ask?"}',
  '  Q_CHOICE_ONLY_ASK_YES["Yes"]',
  '  Q_CHOICE_ONLY_ASK_NO["No"]',
  '  B_ONLY_END["End"]',
  "  B_ONLY_START --> Q_ONLY_ASK",
  "  Q_ONLY_ASK --> Q_CHOICE_ONLY_ASK_YES --> B_ONLY_END",
  "  Q_ONLY_ASK --> Q_CHOICE_ONLY_ASK_NO --> B_ONLY_END",
  "",
].join("\n");

async function openDiagramText(text: string) {
  await resetEditorFixture();
  await executeExpression("window.capturedErrors = []; window.addEventListener('error', (event) => window.capturedErrors.push(String(event.message))); window.addEventListener('unhandledrejection', (event) => window.capturedErrors.push('rejection: ' + String(event.reason && event.reason.message || event.reason)));");
  await executeExpression(`showOpenedFile('/tmp/phone-click-path.mmd', ${JSON.stringify(text)})`);
  await waitMilliseconds(1000);
}

async function listPhoneNodeIds(): Promise<string[]> {
  return executeExpression("JSON.stringify([...document.querySelectorAll('#phoneDiagram [data-node-id]')].map(el => el.dataset.nodeId))").then(JSON.parse);
}

async function readPhoneText(): Promise<string> {
  return executeExpression("document.getElementById('phoneDiagram').textContent.trim()");
}

async function clickNodeAndWait(id: string) {
  await clickNodeWithMouse(id);
  await waitMilliseconds(500);
}

test("test_phone_shows_start_prompt_when_the_diagram_has_two_start_nodes_and_nothing_was_clicked", async () => {
  // Scenario: two start nodes and no phone path; the phone shows the greyed top bar and the prompt, with no nodes.
  await openDiagramText(TWO_START_NODES);
  // The screen now also holds the greyed top bar.
  // assert.equal(await readPhoneText(), START_PROMPT);
  assert.equal(await executeExpression("document.getElementById('phoneStartPrompt').textContent"), START_PROMPT);
  assert.equal(await executeExpression("document.querySelectorAll('#phoneTopBar button:disabled').length"), 3);
  assert.deepEqual(await listPhoneNodeIds(), []);
});

test("test_phone_shows_no_start_prompt_when_the_diagram_has_one_start_node", async () => {
  // Scenario: one start node; the phone starts there as before.
  await openDiagramText(ONE_START_NODE);
  assert.ok((await listPhoneNodeIds()).includes("B_ONLY_START"));
  assert.ok(!(await readPhoneText()).includes(START_PROMPT));
});

test("test_phone_reset_stays_disabled_after_a_click_on_the_only_start_block", async () => {
  // Scenario: one start node; choosing it by a main-view click leaves nothing visible to reset.
  await openDiagramText(ONE_START_NODE);
  await clickNodeAndWait("B_ONLY_START");
  assert.equal(await executeExpression("document.querySelector('#phoneTopBar [data-reset-decisions]').disabled"), true);
});

test("test_clicking_a_start_node_starts_the_phone_walk_at_that_node", async () => {
  // Scenario: click the second start node B_LAUNCH; the walk starts there and the next decision is open.
  await openDiagramText(TWO_START_NODES);
  await clickNodeAndWait("B_LAUNCH");
  assert.deepEqual(await listPhoneNodeIds(), ["B_LAUNCH", "Q_JSONLS_GIVEN", "Q_CHOICE_JSONLS_GIVEN_YES", "Q_CHOICE_JSONLS_GIVEN_NO"]);
  assert.ok(!(await readPhoneText()).includes(START_PROMPT));
});

test("test_phone_reset_is_enabled_after_a_start_block_is_chosen_and_brings_back_the_start_prompt", async () => {
  // Scenario: choose start node B_LAUNCH, then reset; the start prompt returns and reset is disabled again.
  await openDiagramText(TWO_START_NODES);
  await clickNodeAndWait("B_LAUNCH");
  assert.equal(await executeExpression("document.querySelector('#phoneTopBar [data-reset-decisions]').disabled"), false);
  await executeExpression("document.querySelector('#phoneTopBar [data-reset-decisions]').click()");
  await waitMilliseconds(800);
  assert.equal(await executeExpression("document.getElementById('phoneStartPrompt').textContent"), START_PROMPT);
  assert.equal(await executeExpression("document.querySelector('#phoneTopBar [data-reset-decisions]').disabled"), true);
});

test("test_clicking_the_first_start_node_starts_the_phone_walk_at_that_node", async () => {
  // Scenario: click the first start node Q_INSIDE_REPO_AT_START; the walk starts there, not at B_LAUNCH.
  await openDiagramText(TWO_START_NODES);
  await clickNodeAndWait("Q_INSIDE_REPO_AT_START");
  const nodeIds = await listPhoneNodeIds();
  assert.equal(nodeIds[0], "Q_INSIDE_REPO_AT_START");
  assert.ok(!nodeIds.includes("B_LAUNCH"));
});

test("test_clicking_a_block_shows_the_path_to_it_and_keeps_walking_to_the_next_decision", async () => {
  // Scenario: click B_USE_GIVEN_JSONLS (after the Yes choice of Q_JSONLS_GIVEN); the phone shows the path to it, then the next open decision.
  await openDiagramText(TWO_START_NODES);
  await clickNodeAndWait("B_USE_GIVEN_JSONLS");
  assert.deepEqual(await executeExpression("JSON.stringify(phonePath)").then(JSON.parse), ["Q_CHOICE_JSONLS_GIVEN_YES"]);
  const nodeIds = await listPhoneNodeIds();
  assert.deepEqual(nodeIds.filter((id) => id.startsWith("B_") || id.startsWith("Q_") && !id.startsWith("Q_CHOICE")), ["B_LAUNCH", "Q_JSONLS_GIVEN", "B_USE_GIVEN_JSONLS", "Q_SNAPSHOTS_GIVEN"]);
  assert.equal(await executeExpression("document.querySelector('#phoneDiagram [data-active-question]').dataset.nodeId"), "Q_SNAPSHOTS_GIVEN");
});

test("test_clicking_a_choice_shows_it_as_the_chosen_answer", async () => {
  // Scenario: click the Yes choice of Q_JSONLS_GIVEN; the phone shows that choice as chosen.
  await openDiagramText(TWO_START_NODES);
  await clickNodeAndWait("Q_CHOICE_JSONLS_GIVEN_YES");
  assert.deepEqual(await executeExpression("JSON.stringify(phonePath)").then(JSON.parse), ["Q_CHOICE_JSONLS_GIVEN_YES"]);
  assert.equal(await executeExpression("document.querySelector('#phoneDiagram .phone-choice-chosen').dataset.nodeId"), "Q_CHOICE_JSONLS_GIVEN_YES");
});

test("test_clicking_a_question_makes_it_the_open_decision", async () => {
  // Scenario: click Q_SNAPSHOTS_GIVEN; the phone shows the path to it and the question is open.
  await openDiagramText(TWO_START_NODES);
  await clickNodeAndWait("Q_SNAPSHOTS_GIVEN");
  assert.equal(await executeExpression("document.querySelector('#phoneDiagram [data-active-question]').dataset.nodeId"), "Q_SNAPSHOTS_GIVEN");
  assert.ok((await listPhoneNodeIds()).includes("B_LAUNCH"));
});

test("test_the_clicked_node_gets_a_selected_border_in_the_phone", async () => {
  // Scenario: the clicked block carries the phone-clicked class, so the user sees what was clicked.
  await openDiagramText(TWO_START_NODES);
  await clickNodeAndWait("B_USE_GIVEN_JSONLS");
  assert.deepEqual(await executeExpression("JSON.stringify([...document.querySelectorAll('#phoneDiagram .phone-clicked')].map(el => el.dataset.nodeId))").then(JSON.parse), ["B_USE_GIVEN_JSONLS"]);
});

test("test_reset_decisions_returns_the_phone_to_the_start_prompt", async () => {
  // Scenario: click a node, then press Reset decisions in the phone; the prompt returns.
  await openDiagramText(TWO_START_NODES);
  await clickNodeAndWait("B_USE_GIVEN_JSONLS");
  await executeExpression("document.querySelector('#phoneDiagram button[data-reset-decisions]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
  await waitMilliseconds(500);
  // The screen now also holds the greyed top bar.
  // assert.equal(await readPhoneText(), START_PROMPT);
  assert.equal(await executeExpression("document.getElementById('phoneStartPrompt').textContent"), START_PROMPT);
});
