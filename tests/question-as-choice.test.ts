import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
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
