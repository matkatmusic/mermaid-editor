import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { evaluate, sleep } from "./cdp.ts";

registerBrowserHooks(import.meta.url);

test("test_split_workspace_always_renders_regular_and_phone_views_with_distinct_clicks", async () => {
  // Step: the old mode switch is gone and both panes occupy their fixed shares of the canvas.
  const layout = await evaluate(`JSON.stringify((() => {
    const main = document.getElementById('main').getBoundingClientRect();
    const workspace = document.getElementById('workspace').getBoundingClientRect();
    const phone = document.getElementById('phoneWorkspace').getBoundingClientRect();
    return {
      hasToggle: !!document.getElementById('phoneToggle'),
      workspaceShare: workspace.width / main.width,
      phoneShare: phone.width / main.width,
      phoneExtraWidth: phone.width - document.getElementById('phoneOutput').getBoundingClientRect().width,
      regularSvg: !!document.querySelector('#diagram svg'),
      phoneHasBlocks: document.querySelectorAll('#phoneDiagram [data-node-id]').length > 0,
      regularWidthStyle: document.querySelector('#diagram svg')?.style.width,
    };
  })())`).then(JSON.parse);
  assert.equal(layout.hasToggle, false);
  // The phone area is now only as wide as the phone, so there is no fixed 65/35 split.
  // assert.ok(Math.abs(layout.workspaceShare - 0.65) < 0.02);
  // assert.ok(Math.abs(layout.phoneShare - 0.35) < 0.02);
  assert.ok(layout.phoneExtraWidth >= 0 && layout.phoneExtraWidth < 30, JSON.stringify(layout));
  assert.equal(layout.regularSvg, true);
  assert.equal(layout.phoneHasBlocks, true);
  assert.match(layout.regularWidthStyle, /^\d+(?:\.\d+)?px$/);

  // Step: the log/undo UI is gone; scrolling with masking replaces it.
  const removedUi = await evaluate(
    "JSON.stringify({logBtn: !!document.getElementById('logBtn'), undoBtn: !!document.getElementById('undoBtn'), logBox: !!document.getElementById('logBox'), phoneBar: !!document.getElementById('phoneBar')})"
  ).then(JSON.parse);
  assert.deepEqual(removedUi, { logBtn: false, undoBtn: false, logBox: false, phoneBar: false });

  // Step: click opens editor selection; phone choice advances the phone path and picks the next open decision.
  await evaluate("document.getElementById('resetBtn').click()");
  await sleep(300);
  await evaluate("document.querySelector('#diagram [id*=\"flowchart-Q_THEM_DONE_SPEAKING-\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
  assert.equal(await evaluate("selectedEditorNodeId"), 'Q_THEM_DONE_SPEAKING');
  await evaluate("document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_THEM_DONE_SPEAKING_Y\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
  await sleep(300);
  assert.equal(await evaluate("phonePath.length"), 1);
  assert.equal(await evaluate("selectedEditorNodeId"), 'Q_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID');
});

test("test_phone_view_shows_the_start_slice", async () => {
  // Step: a prior test's phone click can leave the path dirty; reset first.
  await evaluate("document.getElementById('resetBtn').click()");
  await sleep(300);
  // Step: the open decision at the start is the diagram's first question, unmasked, with no separator yet.
  const state = await evaluate(`JSON.stringify((() => {
    const active = document.querySelector('#phoneDiagram [data-active-question]');
    return {
      activeId: active?.dataset.nodeId,
      separatorCount: document.querySelectorAll('#phoneDiagram .phone-separator').length,
      maskedCount: document.querySelectorAll('#phoneDiagram .phone-decision-past').length,
    };
  })())`).then(JSON.parse);
  assert.equal(state.activeId, 'Q_THEM_DONE_SPEAKING');
  assert.equal(state.separatorCount, 0);
  assert.equal(state.maskedCount, 0);
  // Step: every question spans the full phone viewport width; static blocks are inset by their 8px margin.
  const widths = await evaluate(`JSON.stringify((() => {
    const paneWidth = document.getElementById('phoneDiagram').clientWidth;
    const questionWidths = Array.from(document.querySelectorAll('#phoneDiagram .phone-question')).map(el => el.getBoundingClientRect().width);
    const blockWidths = Array.from(document.querySelectorAll('#phoneDiagram .phone-block')).map(el => el.getBoundingClientRect().width);
    return { paneWidth, questionWidths, blockWidths };
  })())`).then(JSON.parse);
  for (const width of widths.questionWidths)
    assert.ok(Math.abs(width - widths.paneWidth) < 1, JSON.stringify(widths));
  for (const width of widths.blockWidths)
    assert.ok(Math.abs(width - (widths.paneWidth - 16)) < 1, JSON.stringify(widths));
  // Step: the open question's two choices split the row evenly, with a visible gap between them.
  const choiceWidths = await evaluate(`JSON.stringify((() => {
    const choices = Array.from(document.querySelectorAll('#phoneDiagram [data-active-question] ~ .phone-choice-row .phone-choice'));
    return { widths: choices.map(el => el.getBoundingClientRect().width) };
  })())`).then(JSON.parse);
  assert.equal(choiceWidths.widths.length, 2);
  assert.ok(Math.abs(choiceWidths.widths[0] - choiceWidths.widths[1]) < 1, JSON.stringify(choiceWidths));
});

test("test_clicking_a_decision_choice_masks_it_and_opens_the_next_decision", async () => {
  // Step: click the "Yes" answer under "are they done speaking".
  await evaluate(
    "document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_THEM_DONE_SPEAKING_Y\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
  );
  await sleep(300);
  const state = await evaluate(`JSON.stringify((() => {
    const active = document.querySelector('#phoneDiagram [data-active-question]');
    const pastQuestion = document.querySelector('#phoneDiagram [data-node-id="Q_THEM_DONE_SPEAKING"]');
    const pastWrap = pastQuestion.closest('.phone-decision-past');
    return {
      activeId: active?.dataset.nodeId,
      separatorCount: document.querySelectorAll('#phoneDiagram .phone-separator').length,
      pastIsMasked: !!pastWrap,
      chosen: !!pastWrap.querySelector('[data-node-id="Q_CHOICE_THEM_DONE_SPEAKING_Y"].phone-choice-chosen'),
      declined: !!pastWrap.querySelector('[data-node-id="Q_CHOICE_THEM_DONE_SPEAKING_N"].phone-choice-declined'),
    };
  })())`).then(JSON.parse);
  assert.equal(state.activeId, 'Q_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID');
  assert.equal(state.separatorCount, 1);
  assert.equal(state.pastIsMasked, true);
  assert.equal(state.chosen, true);
  assert.equal(state.declined, true);
});

test("test_reset_returns_to_the_start_slice", async () => {
  // Step: press Reset.
  await evaluate("document.getElementById('resetBtn').click()");
  await sleep(300);
  const activeId = await evaluate("document.querySelector('#phoneDiagram [data-active-question]')?.dataset.nodeId");
  assert.equal(activeId, 'Q_THEM_DONE_SPEAKING');
  assert.equal(await evaluate("phonePath.length"), 0);
});
