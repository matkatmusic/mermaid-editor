import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { resetEditorFixture, setEditorSource } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url);

test("test_diagram_loop_appends_the_repeated_nodes_instead_of_stopping", async () => {
  // Step: "No" loops back to "Me: Listen"; the phone log should keep going, not end at the masked decision.
  await executeExpression(
    "document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_THEM_DONE_SPEAKING_N\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
  );
  await waitMilliseconds(300);
  const state = await executeExpression(`JSON.stringify((() => {
    return {
      listenCount: document.querySelectorAll('#phoneDiagram [data-node-id="B_SELF_LISTEN"]').length,
      questionCount: document.querySelectorAll('#phoneDiagram [data-node-id="Q_THEM_DONE_SPEAKING"]').length,
      hasActive: !!document.querySelector('#phoneDiagram [data-active-question]'),
    };
  })())`).then(JSON.parse);
  assert.equal(state.listenCount, 2);
  assert.equal(state.questionCount, 2);
  assert.equal(state.hasActive, true);
  // Step: reset so later tests start clean.
  await executeExpression("document.getElementById('resetBtn').click()");
  await waitMilliseconds(300);
});

test("test_clicking_a_phone_choice_selects_and_centers_the_next_decision_without_moving_the_page", async () => {
  // Step: phone choice selects and centers the view on the new decision without scrolling the page.
  await executeExpression("window.scrollTo(0, 5);");
  const pageBefore = await executeExpression("window.scrollY");
  await executeExpression(
    "document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_THEM_DONE_SPEAKING_Y\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
  );
  await waitMilliseconds(300);
  const pageAfter = await executeExpression("window.scrollY");
  assert.equal(pageAfter, pageBefore);
  assert.equal(await executeExpression("selectedEditorNodeId"), 'Q_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID');
  await executeExpression("document.getElementById('resetBtn').click()");
  await waitMilliseconds(300);
});

test("test_phone_view_handles_a_diagram_with_no_edges", async () => {
  // Step: replace the code with a diagram that has no edges, while phone view is on.
  await executeExpression(
    "codeBox.value = 'flowchart TD\\n  B_ONLY_ONE_BOX[Only one box]'; codeBox.dispatchEvent(new Event('input'))"
  );
  await waitMilliseconds(500);
  // Step: no error is shown, and the single node still renders.
  const errorText = await executeExpression("document.getElementById('error').textContent");
  assert.equal(errorText, "");
  const hasNodeA = await executeExpression(
    "JSON.stringify(!!document.querySelector('#phoneDiagram [data-node-id=\"B_ONLY_ONE_BOX\"]'))"
  );
  assert.equal(hasNodeA, "true");
  // Step: restore the accountability diagram for any tests that follow.
  await executeExpression("loadDiagram('accountability.mmd')");
  await waitMilliseconds(300);
});

test("test_phone_choice_width_splits_the_viewport_by_choice_count", async () => {
  // Step: a fresh three-choice fixture, independent of the accountability diagram.
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  Q_FIRST{"First?"}\n  Q_CHOICE_FIRST_A["A"]\n  Q_CHOICE_FIRST_B["B"]\n  Q_CHOICE_FIRST_C["C"]\n  Q_FIRST --> Q_CHOICE_FIRST_A\n  Q_FIRST --> Q_CHOICE_FIRST_B\n  Q_FIRST --> Q_CHOICE_FIRST_C');
  await waitMilliseconds(300);
  const widths = await executeExpression(`JSON.stringify((() => {
    const choices = Array.from(document.querySelectorAll('#phoneDiagram .phone-choice-row .phone-choice'));
    return { widths: choices.map(el => el.getBoundingClientRect().width) };
  })())`).then(JSON.parse);
  assert.equal(widths.widths.length, 3);
  for (const width of widths.widths)
    assert.ok(Math.abs(width - widths.widths[0]) < 1, JSON.stringify(widths));
  await executeExpression("loadDiagram('accountability.mmd')");
  await waitMilliseconds(300);
});

test("test_syntax_error_keeps_last_good_diagram_and_shows_error_log", async () => {
  // Step: open the drawer if it is closed, so the editor is interactable.
  const drawerClosed = await executeExpression("document.getElementById('drawer').classList.contains('closed')");
  if (drawerClosed) {
    await executeExpression("document.getElementById('drawerToggle').click()");
  }
  // Step: set valid diagram text and confirm it renders.
  await executeExpression(
    "codeBox.value = 'flowchart TD\\n  B_OK[ok]\\n  B_GOOD[good]\\n  B_OK --> B_GOOD'; codeBox.dispatchEvent(new Event('input'))"
  );
  await waitMilliseconds(300);
  const hasSvg = await executeExpression("!!document.querySelector('#diagram svg')");
  assert.equal(hasSvg, true);
  // Step: set broken diagram text; the last good svg stays and the error log opens.
  await executeExpression(
    "codeBox.value = 'flowchart TD\\n  B_OK[ok]\\n  B_GOOD[good]\\n  B_OK --> '; codeBox.dispatchEvent(new Event('input'))"
  );
  await waitMilliseconds(500);
  const stillHasSvg = await executeExpression("!!document.querySelector('#diagram svg')");
  assert.equal(stillHasSvg, true);
  const hasNodeB = await executeExpression('!!document.querySelector(\'#diagram [id*="flowchart-B_GOOD-"]\')');
  assert.equal(hasNodeB, true);
  const errorLogOpen = await executeExpression("document.getElementById('errorLog').classList.contains('open')");
  assert.equal(errorLogOpen, true);
  const errorLogText = await executeExpression("document.getElementById('errorLog').textContent");
  assert.ok(errorLogText.length > 0);
  // Step: fix the diagram text; the error log closes again.
  await executeExpression(
    "codeBox.value = 'flowchart TD\\n  B_OK[ok]\\n  B_GOOD[good]\\n  B_OK --> B_GOOD'; codeBox.dispatchEvent(new Event('input'))"
  );
  await waitMilliseconds(300);
  const errorLogClosed = await executeExpression("document.getElementById('errorLog').classList.contains('open')");
  assert.equal(errorLogClosed, false);
  // Step: restore the accountability diagram so later runs start clean.
  await executeExpression("loadDiagram('accountability.mmd')");
  await waitMilliseconds(300);
});
