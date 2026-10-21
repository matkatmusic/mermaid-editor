import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { dispatchNodeClick } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url);

test("test_clicking_a_declined_option_reverts_to_that_branch", async () => {
  // Step: answer two decisions in a row.
  await executeExpression(
    "document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_THEM_DONE_SPEAKING_Y\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
  );
  await waitMilliseconds(300);
  await executeExpression(
    "document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID_N\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
  );
  await waitMilliseconds(300);
  assert.deepEqual(await executeExpression("phonePath.slice()"), ['Q_CHOICE_THEM_DONE_SPEAKING_Y', 'Q_CHOICE_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID_N']);
  // Step: scroll up and click the declined "No" on the first decision instead.
  await executeExpression(
    "document.querySelector('#phoneDiagram [data-node-id=\"Q_THEM_DONE_SPEAKING\"] ~ .phone-choice-row [data-node-id=\"Q_CHOICE_THEM_DONE_SPEAKING_N\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
  );
  await waitMilliseconds(300);
  // Step: the path now holds only the reverted branch; the second decision is cleared, not just undone.
  assert.deepEqual(await executeExpression("phonePath.slice()"), ['Q_CHOICE_THEM_DONE_SPEAKING_N']);
  const chosenAfterRevert = await executeExpression(
    "document.querySelector('#phoneDiagram [data-node-id=\"Q_CHOICE_THEM_DONE_SPEAKING_N\"]').classList.contains('phone-choice-chosen')"
  );
  assert.equal(chosenAfterRevert, true);
  // Step: reset for later tests.
  await executeExpression("document.getElementById('resetBtn').click()");
  await waitMilliseconds(300);
});

test("test_undo_decision_pops_the_last_answer_and_hides_with_no_answers", async () => {
  assert.equal(await executeExpression("!!document.querySelector('#phoneDiagram [data-undo]')"), false);
  await executeExpression(
    "document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_THEM_DONE_SPEAKING_Y\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
  );
  await waitMilliseconds(300);
  assert.equal(await executeExpression("!!document.querySelector('#phoneTopBar [data-undo]')"), true);
  await executeExpression("document.querySelector('#phoneDiagram [data-undo]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
  await waitMilliseconds(300);
  assert.deepEqual(await executeExpression("phonePath.slice()"), []);
  assert.equal(await executeExpression("!!document.querySelector('#phoneDiagram [data-undo]')"), false);
});

test("test_phone_reset_decisions_clears_every_answer", async () => {
  await executeExpression(
    "document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_THEM_DONE_SPEAKING_Y\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
  );
  await waitMilliseconds(300);
  await executeExpression(
    "document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID_N\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
  );
  await waitMilliseconds(300);
  await executeExpression("document.querySelector('#phoneTopBar [data-reset-decisions]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
  await waitMilliseconds(300);
  assert.deepEqual(await executeExpression("phonePath.slice()"), []);
  assert.equal(await executeExpression("!!document.querySelector('#phoneTopBar')"), false);
});

test("test_answering_a_main_view_focused_decision_rebuilds_the_phone_path_to_it", async () => {
  // Scenario: before the fix, this answer was appended off-path and the phone stuck at the first decision.
  await dispatchNodeClick("Q_CLARIFY_ISSUE_COUNT");
  await waitMilliseconds(300);
  await executeExpression(
    "document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_CLARIFY_ISSUE_COUNT_MULTIPLE\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
  );
  await waitMilliseconds(300);
  assert.deepEqual(await executeExpression("phonePath.slice()"), ['Q_CHOICE_THEM_DONE_SPEAKING_Y', 'Q_CHOICE_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID_N', 'Q_CHOICE_CLARIFY_ISSUE_COUNT_MULTIPLE']);
  const chosen = await executeExpression("document.querySelector('#phoneDiagram [data-node-id=\"Q_CHOICE_CLARIFY_ISSUE_COUNT_MULTIPLE\"]').classList.contains('phone-choice-chosen')");
  assert.equal(chosen, true);
  await executeExpression("document.getElementById('resetBtn').click()");
  await waitMilliseconds(300);
});

test("test_multiple_past_decisions_are_all_masked_while_scrolling", async () => {
  await executeExpression(
    "document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_THEM_DONE_SPEAKING_Y\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
  );
  await waitMilliseconds(300);
  await executeExpression(
    "document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID_Y\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
  );
  await waitMilliseconds(300);
  // Step: both answered decisions are masked; exactly one separator sits right before the open decision.
  const state = await executeExpression(`JSON.stringify((() => {
    return {
      maskedCount: document.querySelectorAll('#phoneDiagram .phone-decision-past').length,
      separatorCount: document.querySelectorAll('#phoneDiagram .phone-separator').length,
      activeId: document.querySelector('#phoneDiagram [data-active-question]')?.dataset.nodeId,
    };
  })())`).then(JSON.parse);
  assert.equal(state.maskedCount, 2);
  assert.equal(state.separatorCount, 1);
  assert.ok(state.activeId);
  await executeExpression("document.getElementById('resetBtn').click()");
  await waitMilliseconds(300);
});

test("test_clicking_the_no_answer_masks_the_decision_with_both_options_visible", async () => {
  // Step: click the "No" answer under "are they done speaking" (this diagram loops "No" back to re-listen).
  await executeExpression(
    "document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_THEM_DONE_SPEAKING_N\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
  );
  await waitMilliseconds(300);
  const state = await executeExpression(`JSON.stringify((() => {
    const pastWrap = document.querySelector('#phoneDiagram [data-node-id="Q_THEM_DONE_SPEAKING"]').closest('.phone-decision-past');
    return {
      pastIsMasked: !!pastWrap,
      chosenIsNo: !!pastWrap.querySelector('[data-node-id="Q_CHOICE_THEM_DONE_SPEAKING_N"].phone-choice-chosen'),
      declinedIsYes: !!pastWrap.querySelector('[data-node-id="Q_CHOICE_THEM_DONE_SPEAKING_Y"].phone-choice-declined'),
    };
  })())`).then(JSON.parse);
  assert.equal(state.pastIsMasked, true);
  assert.equal(state.chosenIsNo, true);
  assert.equal(state.declinedIsYes, true);
  // Step: reset so later tests start clean.
  await executeExpression("document.getElementById('resetBtn').click()");
  await waitMilliseconds(300);
});
