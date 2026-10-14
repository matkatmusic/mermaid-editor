import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { evaluate, sleep } from "./cdp.ts";
import { clickNode, openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickInspectorAction } from "./inspector-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test('test_main_view_choice_and_regular_nodes_preview_their_feeding_decision_as_chosen', async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_ROOT["Root"]\n  Q_FIRST{"First?"}\n  Q_CHOICE_FIRST_Y["Yes"]\n  Q_CHOICE_FIRST_N["No"]\n  B_ONE["One"]\n  B_TWO["Two"]\n  Q_NEXT{"Next?"}\n  Q_CHOICE_NEXT_Y["Yes"]\n  Q_CHOICE_NEXT_N["No"]\n  B_ROOT --> Q_FIRST\n  Q_FIRST --> Q_CHOICE_FIRST_Y --> B_ONE --> B_TWO --> Q_NEXT\n  Q_FIRST --> Q_CHOICE_FIRST_N\n  Q_NEXT --> Q_CHOICE_NEXT_Y\n  Q_NEXT --> Q_CHOICE_NEXT_N');
  await clickNode('B_TWO');
  await sleep(300);
  assert.equal(await evaluate('phonePreviewChoiceId'), 'Q_CHOICE_FIRST_Y');
  assert.equal(await evaluate('phoneFocusNodeId'), null);
  assert.equal(await evaluate('phonePath.length'), 0);
  for (const id of ['Q_FIRST', 'Q_CHOICE_FIRST_Y', 'B_ONE', 'B_TWO', 'Q_NEXT', 'Q_CHOICE_NEXT_Y', 'Q_CHOICE_NEXT_N'])
    assert.equal(await evaluate(`!!document.querySelector('#phoneDiagram [data-node-id="${id}"]')`), true, id);
  assert.equal(await evaluate("currentBottomQ"), 'Q_NEXT');

  // A choice previews the same non-logged decision outcome.
  await clickNode('Q_CHOICE_FIRST_Y');
  await sleep(300);
  assert.equal(await evaluate('phonePreviewChoiceId'), 'Q_CHOICE_FIRST_Y');
  assert.equal(await evaluate('phonePath.length'), 0);

  // A regular node with no feeding decision leaves that preview untouched.
  await clickNode('B_ROOT');
  await sleep(100);
  assert.equal(await evaluate('phonePreviewChoiceId'), 'Q_CHOICE_FIRST_Y');

  // Decisions themselves remain the only nodes focused directly by the phone.
  await clickNode('Q_NEXT');
  await sleep(300);
  assert.equal(await evaluate('phoneFocusNodeId'), 'Q_NEXT');
  assert.equal(await evaluate('phonePreviewChoiceId'), null);
  assert.equal(await evaluate('currentBottomQ'), 'Q_NEXT');
});

test('test_header_zoom_controls_resize_only_the_main_mermaid_diagram', async () => {
  await resetEditorFixture();
  await evaluate("document.getElementById('zoomResetBtn').click()");
  const dimensions = () => evaluate(`JSON.stringify((() => {
    const regularSvg = document.querySelector('#diagram svg');
    return {
      regularWidth: Number.parseFloat(regularSvg.style.width),
      regularHeight: Number.parseFloat(regularSvg.style.height),
      outputWidth: document.getElementById('output').getBoundingClientRect().width,
      drawerWidth: document.getElementById('drawer').getBoundingClientRect().width,
      level: document.getElementById('zoomLevel').textContent,
      buttons: Array.from(document.querySelectorAll('#mainZoomControls button')).map(button => button.id),
    };
  })())`).then(JSON.parse);
  const initial = await dimensions();
  assert.deepEqual(initial.buttons, ['zoomInBtn', 'zoomOutBtn', 'zoomResetBtn']);
  assert.equal(initial.level, '100%');

  await evaluate("document.getElementById('zoomInBtn').click()");
  const zoomed = await dimensions();
  assert.ok(Math.abs(zoomed.regularWidth / initial.regularWidth - 1.1) < 0.0001, JSON.stringify({ initial, zoomed }));
  assert.ok(Math.abs(zoomed.regularHeight / initial.regularHeight - 1.1) < 0.0001, JSON.stringify({ initial, zoomed }));
  assert.equal(zoomed.outputWidth, initial.outputWidth);
  assert.equal(zoomed.drawerWidth, initial.drawerWidth);
  assert.equal(zoomed.level, '110%');

  await evaluate("document.getElementById('zoomOutBtn').click()");
  const restoredByMinus = await dimensions();
  assert.ok(Math.abs(restoredByMinus.regularWidth - initial.regularWidth) < 0.000001);
  assert.equal(restoredByMinus.level, '100%');
  await evaluate("document.getElementById('zoomInBtn').click(); document.getElementById('zoomInBtn').click(); document.getElementById('zoomResetBtn').click()");
  const reset = await dimensions();
  assert.ok(Math.abs(reset.regularWidth - initial.regularWidth) < 0.000001);
  assert.equal(reset.level, '100%');
});

test('test_previous_selections_stay_masked_through_each_phone_choice', async () => {
  await evaluate("loadDiagram('accountability.mmd')");
  await sleep(500);
  await evaluate("document.getElementById('resetBtn').click()");
  await sleep(300);
  await evaluate(`document.querySelector('#phoneDiagram [data-choose="Q_CHOICE_THEM_DONE_SPEAKING_Y"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
  await sleep(400);
  const firstState = await evaluate(`JSON.stringify((() => {
    return {
      firstMasked: !!document.querySelector('#phoneDiagram [data-node-id="Q_THEM_DONE_SPEAKING"]').closest('.phone-decision-past'),
      activeId: document.querySelector('#phoneDiagram [data-active-question]')?.dataset.nodeId,
      separatorCount: document.querySelectorAll('#phoneDiagram .phone-separator').length,
    };
  })())`).then(JSON.parse);
  assert.equal(firstState.firstMasked, true);
  assert.equal(firstState.activeId, 'Q_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID');
  assert.equal(firstState.separatorCount, 1);
  await evaluate(`document.querySelector('#phoneDiagram [data-choose="Q_CHOICE_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID_N"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
  await sleep(400);
  const secondState = await evaluate(`JSON.stringify((() => {
    return {
      firstMasked: !!document.querySelector('#phoneDiagram [data-node-id="Q_THEM_DONE_SPEAKING"]').closest('.phone-decision-past'),
      secondMasked: !!document.querySelector('#phoneDiagram [data-node-id="Q_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID"]').closest('.phone-decision-past'),
      separatorCount: document.querySelectorAll('#phoneDiagram .phone-separator').length,
      phonePath: phonePath.slice(),
      currentBottomQ,
    };
  })())`).then(JSON.parse);
  assert.deepEqual(secondState.phonePath, ['Q_CHOICE_THEM_DONE_SPEAKING_Y', 'Q_CHOICE_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID_N']);
  assert.equal(secondState.currentBottomQ, 'Q_CLARIFY_ISSUE_COUNT');
  assert.equal(secondState.firstMasked, true);
  assert.equal(secondState.secondMasked, true);
  assert.equal(secondState.separatorCount, 1);
  await evaluate("document.getElementById('resetBtn').click()");
  await sleep(300);
});

test('test_add_and_insert_actions_preserve_the_zoom_scale_in_the_regular_view', async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_START["Start"]\n  Q_FIRST{"First?"}\n  Q_CHOICE_FIRST_Y["Yes"]\n  Q_CHOICE_FIRST_N["No"]\n  B_END["End"]\n  B_START --> Q_FIRST\n  Q_FIRST --> Q_CHOICE_FIRST_Y --> B_END\n  Q_FIRST --> Q_CHOICE_FIRST_N');
  const scales = () => evaluate(`JSON.stringify((() => {
    const svg = document.querySelector('#diagram svg');
    return { regular: Number.parseFloat(svg.style.height) / svg.viewBox.baseVal.height };
  })())`).then(JSON.parse);
  await evaluate("document.getElementById('zoomResetBtn').click(); document.getElementById('zoomInBtn').click()");
  const initial = await scales();

  await clickNode('Q_FIRST');
  await clickInspectorAction('add-choice');
  const afterAdd = await scales();
  assert.ok(Math.abs(afterAdd.regular - initial.regular) < 0.000001);

  await clickNode('B_START');
  await clickInspectorAction('insert-decision-after');
  const afterInsert = await scales();
  assert.ok(Math.abs(afterInsert.regular - initial.regular) < 0.000001);
  await evaluate("document.getElementById('zoomResetBtn').click()");
});
