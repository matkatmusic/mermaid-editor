import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression, waitForRender, waitMilliseconds } from "../../cdp.ts";
import { dispatchNodeClick, openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickInspectorAction } from "../../inspector-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test('test_main_view_click_shows_the_path_to_the_clicked_node_in_the_phone', async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_ROOT["Root"]\n  Q_FIRST{"First?"}\n  Q_CHOICE_FIRST_Y["Yes"]\n  Q_CHOICE_FIRST_N["No"]\n  B_ONE["One"]\n  B_TWO["Two"]\n  Q_NEXT{"Next?"}\n  Q_CHOICE_NEXT_Y["Yes"]\n  Q_CHOICE_NEXT_N["No"]\n  B_ROOT --> Q_FIRST\n  Q_FIRST --> Q_CHOICE_FIRST_Y --> B_ONE --> B_TWO --> Q_NEXT\n  Q_FIRST --> Q_CHOICE_FIRST_N\n  Q_NEXT --> Q_CHOICE_NEXT_Y\n  Q_NEXT --> Q_CHOICE_NEXT_N');
  await dispatchNodeClick('B_TWO');
  await waitForRender();
  assert.equal(await executeExpression('phonePreviewChoiceId'), null);
  assert.equal(await executeExpression('phoneFocusNodeId'), null);
  // assert.deepEqual(await executeExpression('JSON.stringify(phonePath)').then(JSON.parse), ['Q_CHOICE_FIRST_Y']);
  // assert.deepEqual(await executeExpression<string>('JSON.stringify(phonePath)').then(JSON.parse), ['Q_CHOICE_FIRST_Y']);
  assert.deepEqual(await executeExpression<string>('JSON.stringify(phonePath)').then((json) => JSON.parse(json) as string[]), ['Q_CHOICE_FIRST_Y']);
  for (const id of ['Q_FIRST', 'Q_CHOICE_FIRST_Y', 'B_ONE', 'B_TWO', 'Q_NEXT', 'Q_CHOICE_NEXT_Y', 'Q_CHOICE_NEXT_N'])
    assert.equal(await executeExpression(`!!document.querySelector('#phoneDiagram [data-node-id="${id}"]')`), true, id);
  assert.equal(await executeExpression("currentBottomQ"), 'Q_NEXT');

  // A choice joins the path as the chosen answer.
  await dispatchNodeClick('Q_CHOICE_FIRST_N');
  await waitForRender();
  // assert.deepEqual(await executeExpression('JSON.stringify(phonePath)').then(JSON.parse), ['Q_CHOICE_FIRST_N']);
  // assert.deepEqual(await executeExpression<string>('JSON.stringify(phonePath)').then(JSON.parse), ['Q_CHOICE_FIRST_N']);
  assert.deepEqual(await executeExpression<string>('JSON.stringify(phonePath)').then((json) => JSON.parse(json) as string[]), ['Q_CHOICE_FIRST_N']);

  // The start node alone gives an empty path.
  await dispatchNodeClick('B_ROOT');
  await waitMilliseconds(500);
  assert.equal(await executeExpression('phonePath.length'), 0);

  // A decision is the open decision at the end of its path.
  await dispatchNodeClick('Q_NEXT');
  await waitForRender();
  // assert.deepEqual(await executeExpression('JSON.stringify(phonePath)').then(JSON.parse), ['Q_CHOICE_FIRST_Y']);
  // assert.deepEqual(await executeExpression<string>('JSON.stringify(phonePath)').then(JSON.parse), ['Q_CHOICE_FIRST_Y']);
  assert.deepEqual(await executeExpression<string>('JSON.stringify(phonePath)').then((json) => JSON.parse(json) as string[]), ['Q_CHOICE_FIRST_Y']);
  assert.equal(await executeExpression("document.querySelector('#phoneDiagram [data-active-question]').dataset.nodeId"), 'Q_NEXT');
});

test('test_header_zoom_controls_resize_only_the_main_mermaid_diagram', async () => {
  await resetEditorFixture();
  await executeExpression("document.getElementById('zoomResetBtn').click()");
  // const dimensions = () => executeExpression(`JSON.stringify((() => {
  const dimensions = () => executeExpression<string>(`JSON.stringify((() => {
    const regularSvg = document.querySelector('#diagram svg');
    return {
      regularWidth: Number.parseFloat(regularSvg.style.width),
      regularHeight: Number.parseFloat(regularSvg.style.height),
      outputWidth: document.getElementById('output').getBoundingClientRect().width,
      drawerWidth: document.getElementById('drawer').getBoundingClientRect().width,
      level: document.getElementById('zoomLevel').textContent,
      buttons: Array.from(document.querySelectorAll('#mainZoomControls button')).map(button => button.id),
    };
  })())`).then((json) => JSON.parse(json) as { regularWidth: number; regularHeight: number; outputWidth: number; drawerWidth: number; level: string; buttons: string[] });
  // })())`).then(JSON.parse);
  const initial = await dimensions();
  assert.deepEqual(initial.buttons, ['zoomInBtn', 'zoomOutBtn', 'zoomResetBtn']);
  assert.equal(initial.level, '100%');

  await executeExpression("document.getElementById('zoomInBtn').click()");
  const zoomed = await dimensions();
  assert.ok(Math.abs(zoomed.regularWidth / initial.regularWidth - 1.1) < 0.0001, JSON.stringify({ initial, zoomed }));
  assert.ok(Math.abs(zoomed.regularHeight / initial.regularHeight - 1.1) < 0.0001, JSON.stringify({ initial, zoomed }));
  assert.equal(zoomed.outputWidth, initial.outputWidth);
  assert.equal(zoomed.drawerWidth, initial.drawerWidth);
  assert.equal(zoomed.level, '110%');

  await executeExpression("document.getElementById('zoomOutBtn').click()");
  const restoredByMinus = await dimensions();
  assert.ok(Math.abs(restoredByMinus.regularWidth - initial.regularWidth) < 0.000001);
  assert.equal(restoredByMinus.level, '100%');
  await executeExpression("document.getElementById('zoomInBtn').click(); document.getElementById('zoomInBtn').click(); document.getElementById('zoomResetBtn').click()");
  const reset = await dimensions();
  assert.ok(Math.abs(reset.regularWidth - initial.regularWidth) < 0.000001);
  assert.equal(reset.level, '100%');
});

test('test_previous_selections_stay_masked_through_each_phone_choice', async () => {
  await executeExpression("loadDiagram('accountability.mmd')");
  await waitMilliseconds(500);
  await executeExpression("document.getElementById('resetBtn').click()");
  await waitForRender();
  await executeExpression(`document.querySelector('#phoneDiagram [data-choose="Q_CHOICE_THEM_DONE_SPEAKING_Y"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
  await waitMilliseconds(400);
  // const firstState = await executeExpression(`JSON.stringify((() => {
  const firstState = await executeExpression<string>(`JSON.stringify((() => {
    return {
      firstMasked: !!document.querySelector('#phoneDiagram [data-node-id="Q_THEM_DONE_SPEAKING"]').closest('.phone-decision-past'),
      activeId: document.querySelector('#phoneDiagram [data-active-question]')?.dataset.nodeId,
      separatorCount: document.querySelectorAll('#phoneDiagram .phone-separator').length,
    };
  })())`).then((json) => JSON.parse(json) as { firstMasked: boolean; activeId?: string; separatorCount: number });
  // })())`).then(JSON.parse);
  assert.equal(firstState.firstMasked, true);
  assert.equal(firstState.activeId, 'Q_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID');
  assert.equal(firstState.separatorCount, 1);
  await executeExpression(`document.querySelector('#phoneDiagram [data-choose="Q_CHOICE_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID_N"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
  await waitMilliseconds(400);
  // const secondState = await executeExpression(`JSON.stringify((() => {
  const secondState = await executeExpression<string>(`JSON.stringify((() => {
    return {
      firstMasked: !!document.querySelector('#phoneDiagram [data-node-id="Q_THEM_DONE_SPEAKING"]').closest('.phone-decision-past'),
      secondMasked: !!document.querySelector('#phoneDiagram [data-node-id="Q_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID"]').closest('.phone-decision-past'),
      separatorCount: document.querySelectorAll('#phoneDiagram .phone-separator').length,
      phonePath: phonePath.slice(),
      currentBottomQ,
    };
  })())`).then((json) => JSON.parse(json) as { firstMasked: boolean; secondMasked: boolean; separatorCount: number; phonePath: string[]; currentBottomQ?: string });
  // })())`).then(JSON.parse);
  assert.deepEqual(secondState.phonePath, ['Q_CHOICE_THEM_DONE_SPEAKING_Y', 'Q_CHOICE_DO_I_UNDERSTAND_EVERYTHING_THEY_SAID_N']);
  assert.equal(secondState.currentBottomQ, 'Q_CLARIFY_ISSUE_COUNT');
  assert.equal(secondState.firstMasked, true);
  assert.equal(secondState.secondMasked, true);
  assert.equal(secondState.separatorCount, 1);
  await executeExpression("document.getElementById('resetBtn').click()");
  await waitForRender();
});

test('test_add_and_insert_actions_preserve_the_zoom_scale_in_the_regular_view', async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_START["Start"]\n  Q_FIRST{"First?"}\n  Q_CHOICE_FIRST_Y["Yes"]\n  Q_CHOICE_FIRST_N["No"]\n  B_END["End"]\n  B_START --> Q_FIRST\n  Q_FIRST --> Q_CHOICE_FIRST_Y --> B_END\n  Q_FIRST --> Q_CHOICE_FIRST_N');
  // const scales = () => executeExpression(`JSON.stringify((() => {
  const scales = () => executeExpression<string>(`JSON.stringify((() => {
    const svg = document.querySelector('#diagram svg');
    return { regular: Number.parseFloat(svg.style.height) / svg.viewBox.baseVal.height };
  })())`).then((json) => JSON.parse(json) as { regular: number });
  // })())`).then(JSON.parse);
  await executeExpression("document.getElementById('zoomResetBtn').click(); document.getElementById('zoomInBtn').click()");
  const initial = await scales();

  await dispatchNodeClick('Q_FIRST');
  await clickInspectorAction('add-choice');
  const afterAdd = await scales();
  // The style height of the svg is rounded; the smaller blocks make the diagram shorter, so the same rounding is a larger part of the scale.
  assert.ok(Math.abs(afterAdd.regular - initial.regular) < 0.00001);

  await dispatchNodeClick('B_START');
  await clickInspectorAction('insert-decision-after');
  const afterInsert = await scales();
  assert.ok(Math.abs(afterInsert.regular - initial.regular) < 0.00001);
  await executeExpression("document.getElementById('zoomResetBtn').click()");
});
