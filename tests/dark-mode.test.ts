import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { evaluate, sleep } from "./cdp.ts";
import { openEditorDrawer } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test('test_dark_mode_toggle_exists_and_is_checked_on_load_with_dark_background', async () => {
  assert.equal(await evaluate("document.getElementById('darkModeToggle').type"), 'checkbox');
  assert.equal(await evaluate("document.getElementById('darkModeToggle').checked"), true);
  assert.equal(await evaluate("getComputedStyle(document.body).backgroundColor"), 'rgb(30, 30, 30)');
});

test('test_dark_mode_on_renders_flowchart_node_text_black', async () => {
  assert.equal(await evaluate("document.getElementById('darkModeToggle').checked"), true);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#diagram .node .nodeLabel p')).color"), 'rgb(0, 0, 0)');
});

test('test_dark_mode_toggle_off_restores_the_light_background_and_on_restores_dark', async () => {
  await evaluate("(() => { const toggle = document.getElementById('darkModeToggle'); toggle.checked = false; toggle.dispatchEvent(new Event('change')); })()");
  assert.equal(await evaluate("getComputedStyle(document.body).backgroundColor"), 'rgb(255, 255, 255)');
  await evaluate("(() => { const toggle = document.getElementById('darkModeToggle'); toggle.checked = true; toggle.dispatchEvent(new Event('change')); })()");
  assert.equal(await evaluate("getComputedStyle(document.body).backgroundColor"), 'rgb(30, 30, 30)');
});

test('test_masked_decision_color_follows_dark_mode', async () => {
  await evaluate("loadDiagram('accountability.mmd')");
  await sleep(500);
  await evaluate("document.getElementById('resetBtn').click()");
  await sleep(300);
  await evaluate(`document.querySelector('#phoneDiagram [data-choose="Q_CHOICE_THEM_DONE_SPEAKING_Y"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
  await sleep(400);
  const maskColor = () => evaluate(
    "getComputedStyle(document.querySelector('#phoneDiagram .phone-decision-past'), '::after').backgroundColor"
  );
  const setDark = (on: boolean) => evaluate(`(() => { const toggle = document.getElementById('darkModeToggle'); toggle.checked = ${on}; toggle.dispatchEvent(new Event('change')); })()`);
  await setDark(true);
  await sleep(400);
  assert.equal(await maskColor(), 'rgba(255, 255, 255, 0.55)');
  await setDark(false);
  await sleep(400);
  assert.equal(await maskColor(), 'rgba(0, 0, 0, 0.55)');
  await evaluate("document.getElementById('resetBtn').click()");
  await sleep(300);
  await setDark(true);
  await sleep(400);
});
