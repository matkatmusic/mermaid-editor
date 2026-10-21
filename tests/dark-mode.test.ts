import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test('test_dark_mode_toggle_exists_and_is_checked_on_load_with_dark_background', async () => {
  assert.equal(await executeExpression("document.getElementById('darkModeToggle').type"), 'checkbox');
  assert.equal(await executeExpression("document.getElementById('darkModeToggle').checked"), true);
  assert.equal(await executeExpression("getComputedStyle(document.body).backgroundColor"), 'rgb(30, 30, 30)');
});

test('test_dark_mode_on_renders_flowchart_node_text_black', async () => {
  assert.equal(await executeExpression("document.getElementById('darkModeToggle').checked"), true);
  assert.equal(await executeExpression("getComputedStyle(document.querySelector('#diagram .node .nodeLabel p')).color"), 'rgb(0, 0, 0)');
});

test('test_dark_mode_toggle_off_restores_the_light_background_and_on_restores_dark', async () => {
  await executeExpression("(() => { const toggle = document.getElementById('darkModeToggle'); toggle.checked = false; toggle.dispatchEvent(new Event('change')); })()");
  assert.equal(await executeExpression("getComputedStyle(document.body).backgroundColor"), 'rgb(255, 255, 255)');
  await executeExpression("(() => { const toggle = document.getElementById('darkModeToggle'); toggle.checked = true; toggle.dispatchEvent(new Event('change')); })()");
  assert.equal(await executeExpression("getComputedStyle(document.body).backgroundColor"), 'rgb(30, 30, 30)');
});

test('test_masked_decision_color_follows_dark_mode', async () => {
  await executeExpression("loadDiagram('accountability.mmd')");
  await waitMilliseconds(500);
  await executeExpression("document.getElementById('resetBtn').click()");
  await waitMilliseconds(300);
  await executeExpression(`document.querySelector('#phoneDiagram [data-choose="Q_CHOICE_THEM_DONE_SPEAKING_Y"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
  await waitMilliseconds(400);
  const maskColor = () => executeExpression(
    "getComputedStyle(document.querySelector('#phoneDiagram .phone-decision-past'), '::after').backgroundColor"
  );
  const setDark = (on: boolean) => executeExpression(`(() => { const toggle = document.getElementById('darkModeToggle'); toggle.checked = ${on}; toggle.dispatchEvent(new Event('change')); })()`);
  await setDark(true);
  await waitMilliseconds(400);
  assert.equal(await maskColor(), 'rgba(255, 255, 255, 0.55)');
  await setDark(false);
  await waitMilliseconds(400);
  assert.equal(await maskColor(), 'rgba(0, 0, 0, 0.55)');
  await executeExpression("document.getElementById('resetBtn').click()");
  await waitMilliseconds(300);
  await setDark(true);
  await waitMilliseconds(400);
});
