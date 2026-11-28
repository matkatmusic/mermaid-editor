import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "../../browser-harness.ts";
// import { executeExpression, waitMilliseconds } from "../../cdp.ts";
import { executeExpression, waitForExpression, waitMilliseconds } from "../../cdp.ts";

registerBrowserHooks(import.meta.url);

async function readDiskText(): Promise<string> {
  const response = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/accountability.mmd`);
  return response.text();
}

async function writeDiskText(text: string) {
  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/accountability.mmd`, { method: "PUT", body: text });
}

test("test_disk_edit_loads_silently_when_the_webapp_has_no_unsaved_edits", async () => {
  // Scenario: a diagram is loaded and untouched; another program changes the file on disk.
  await executeExpression("loadDiagram('accountability.mmd')");
  // await waitMilliseconds(500);
  // Step: count any window.confirm questions.
  await executeExpression("window.confirmCalls = 0; window.confirm = () => { window.confirmCalls++; return false; }");
  // Step: change the file on disk.
  await writeDiskText((await readDiskText()) + "\n%% disk edit silent");
  // await waitMilliseconds(700);
  await waitForExpression("codeBox.value.includes('%% disk edit silent')");
  // Step: the webapp shows the disk text and asked no question.
  // assert.ok((await executeExpression("codeBox.value")).includes("%% disk edit silent"));
  assert.ok((await executeExpression<string>("codeBox.value")).includes("%% disk edit silent"));
  assert.equal(await executeExpression("window.confirmCalls"), 0);
});

test("test_disk_edit_keeps_unsaved_webapp_edits_when_the_user_cancels", async () => {
  // Scenario: the webapp has unsaved edits; the file changes on disk; the user answers Cancel.
  await executeExpression("loadDiagram('accountability.mmd')");
  // await waitMilliseconds(500);
  await executeExpression("window.confirmCalls = 0; window.confirm = () => { window.confirmCalls++; return false; }");
  // Step: make an unsaved edit in the webapp.
  await executeExpression("codeBox.value += '\\n%% webapp edit keep'");
  // Step: change the file on disk.
  await writeDiskText((await readDiskText()) + "\n%% disk edit cancelled");
  // await waitMilliseconds(700);
  await waitForExpression('window.confirmCalls === 1');
  // Step: the webapp asks exactly once and keeps its own text.
  assert.equal(await executeExpression("window.confirmCalls"), 1);
  const codeText: string = await executeExpression("codeBox.value");
  assert.ok(codeText.includes("%% webapp edit keep"));
  assert.ok(!codeText.includes("%% disk edit cancelled"));
});

test("test_disk_edit_asks_once_per_declined_text_and_asks_again_for_new_text", async () => {
  // Scenario: the user cancels; the same disk text arrives in two change events; then different disk text arrives.
  await executeExpression("loadDiagram('accountability.mmd')");
  // await waitMilliseconds(500);
  await executeExpression("window.confirmCalls = 0; window.confirm = () => { window.confirmCalls++; return false; }");
  await executeExpression("codeBox.value += '\\n%% webapp edit declined'");
  // Step: write the same disk text twice, so two change events carry the same text.
  const declinedText = (await readDiskText()) + "\n%% disk edit declined";
  await writeDiskText(declinedText);
  // await waitMilliseconds(500);
  await waitForExpression('window.confirmCalls === 1');
  await writeDiskText(declinedText);
  await waitMilliseconds(700);
  // Step: the question showed once.
  assert.equal(await executeExpression("window.confirmCalls"), 1);
  // Step: different disk text asks again.
  await writeDiskText(declinedText + "\n%% disk edit newer");
  // await waitMilliseconds(700);
  await waitForExpression('window.confirmCalls === 2');
  assert.equal(await executeExpression("window.confirmCalls"), 2);
});

test("test_disk_edit_replaces_unsaved_webapp_edits_when_the_user_confirms", async () => {
  // Scenario: the webapp has unsaved edits; the file changes on disk; the user answers OK.
  await executeExpression("loadDiagram('accountability.mmd')");
  // await waitMilliseconds(500);
  await executeExpression("window.confirmCalls = 0; window.confirm = () => { window.confirmCalls++; return true; }");
  await executeExpression("codeBox.value += '\\n%% webapp edit lose'");
  await writeDiskText((await readDiskText()) + "\n%% disk edit accepted");
  // await waitMilliseconds(700);
  await waitForExpression("codeBox.value.includes('%% disk edit accepted')");
  // Step: the webapp shows the disk text and asked exactly once.
  assert.equal(await executeExpression("window.confirmCalls"), 1);
  const codeText: string = await executeExpression("codeBox.value");
  assert.ok(codeText.includes("%% disk edit accepted"));
  assert.ok(!codeText.includes("%% webapp edit lose"));
});
