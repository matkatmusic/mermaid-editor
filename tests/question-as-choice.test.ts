import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const QUESTION_AS_CHOICE_FIXTURE = [
  'flowchart TD',
  '  Q_ABOUT{"What is the reply about, broadly?"}',
  '  Q_CHOICE_ABOUT_OTHER["other"]',
  '  Q_BROAD_INFORMATION{"\'information\'"}',
  '  Q_CHOICE_BROAD_INFORMATION_PASS["> threshold"]',
  '  Q_CHOICE_BROAD_INFORMATION_FAIL["≤ threshold"]',
  '  B_DO_NOT_BLOCK["Do not block"]',
  '  B_END["End"]',
  '  Q_ABOUT --> Q_BROAD_INFORMATION',
  '  Q_ABOUT --> Q_CHOICE_ABOUT_OTHER --> B_END',
  '  Q_BROAD_INFORMATION --> Q_CHOICE_BROAD_INFORMATION_PASS',
  '  Q_BROAD_INFORMATION --> Q_CHOICE_BROAD_INFORMATION_FAIL --> B_DO_NOT_BLOCK',
].join('\n');

const SINGLE_CHOICE_FIXTURE = [
  'flowchart TD',
  '  Q_A{"First?"}',
  '  Q_CHOICE_A_GO["go"]',
  '  Q_CHOICE_A_STOP["stop"]',
  '  Q_SINGLE{"Only one way?"}',
  '  Q_CHOICE_SINGLE_ONLY["only"]',
  '  Q_FINAL{"Final?"}',
  '  Q_CHOICE_FINAL_YES["yes"]',
  '  Q_CHOICE_FINAL_NO["no"]',
  '  B_END["End"]',
  '  Q_A --> Q_CHOICE_A_GO --> Q_SINGLE',
  '  Q_A --> Q_CHOICE_A_STOP --> B_END',
  '  Q_SINGLE --> Q_CHOICE_SINGLE_ONLY --> Q_FINAL',
  '  Q_FINAL --> Q_CHOICE_FINAL_YES --> B_END',
  '  Q_FINAL --> Q_CHOICE_FINAL_NO --> B_END',
].join('\n');

async function chooseButtonLabels() {
  const json = await executeExpression("JSON.stringify(Array.from(document.querySelectorAll('#phoneDiagram [data-choose]')).map(el => el.dataset.choose + '=' + el.textContent))");
  return JSON.parse(json);
}

test('test_a_question_that_follows_a_question_is_a_choice_button_that_opens_its_own_choices', async () => {
  await resetEditorFixture();
  await setEditorSource(QUESTION_AS_CHOICE_FIXTURE);
  await executeExpression("document.getElementById('resetBtn').click()");
  await waitMilliseconds(300);
  // Step: the first question shows the second question as one of its choice buttons.
  assert.deepEqual(await chooseButtonLabels(), ["Q_BROAD_INFORMATION='information'", 'Q_CHOICE_ABOUT_OTHER=other']);
  // Step: picking it shows its own two choices.
  await executeExpression("document.querySelector('#phoneDiagram [data-choose=\"Q_BROAD_INFORMATION\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
  await waitMilliseconds(300);
  assert.deepEqual(await executeExpression("phonePath.slice()"), ['Q_BROAD_INFORMATION']);
  assert.deepEqual(await chooseButtonLabels(), ['Q_CHOICE_BROAD_INFORMATION_PASS=> threshold', 'Q_CHOICE_BROAD_INFORMATION_FAIL=≤ threshold']);
  assert.equal(await executeExpression("document.querySelector('#phoneDiagram [data-active-question]').dataset.nodeId"), 'Q_BROAD_INFORMATION');
});

test('test_a_single_choice_question_picks_its_choice_itself_and_undo_skips_it', async () => {
  await resetEditorFixture();
  await setEditorSource(SINGLE_CHOICE_FIXTURE);
  await executeExpression("document.getElementById('resetBtn').click()");
  await waitMilliseconds(300);
  await executeExpression("document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_A_GO\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
  await waitMilliseconds(300);
  // Step: one tap lands on the final question; the single-choice box shows with no choice button.
  assert.equal(await executeExpression("document.querySelector('#phoneDiagram [data-active-question]').dataset.nodeId"), 'Q_FINAL');
  assert.equal(await executeExpression("!!document.querySelector('#phoneDiagram [data-node-id=\"Q_SINGLE\"]')"), true);
  assert.equal(await executeExpression("!!document.querySelector('#phoneDiagram [data-node-id=\"Q_SINGLE\"]').closest('.phone-decision').querySelector('.phone-choice')"), false);
  assert.deepEqual(await executeExpression("phonePath.slice()"), ['Q_CHOICE_A_GO']);
  // Step: undo goes back to the last real tap.
  await executeExpression("document.querySelector('#phoneDiagram [data-undo]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
  await waitMilliseconds(300);
  assert.equal(await executeExpression("document.querySelector('#phoneDiagram [data-active-question]').dataset.nodeId"), 'Q_A');
});

test('test_write_path_keeps_the_auto_picked_single_choice_step', async () => {
  await resetEditorFixture();
  await setEditorSource(SINGLE_CHOICE_FIXTURE);
  await executeExpression("document.getElementById('resetBtn').click()");
  await waitMilliseconds(300);
  await executeExpression("document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_A_GO\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
  await waitMilliseconds(300);
  await executeExpression("document.querySelector('#phoneTopBar [data-write-path]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
  await waitMilliseconds(500);
  // Step: the status line names the file just written.
  const status: string = await executeExpression("document.getElementById('status').textContent");
  const writtenName = status.replace('Wrote ', '');
  const pathSource = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${writtenName}`).then((r) => r.text());
  assert.ok(pathSource.includes('%%   Only one way? -> only\n'), pathSource);
  assert.ok(pathSource.includes('  Q_SINGLE{"Only one way?"}\n'), pathSource);
  assert.ok(pathSource.includes('  Q_SINGLE --> Q_CHOICE_SINGLE_ONLY\n'), pathSource);
});
