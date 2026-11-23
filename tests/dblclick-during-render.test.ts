import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { SEARCH_FIXTURE } from "./fixtures.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test("test_double_click_works_when_the_render_of_the_first_click_ends_between_the_second_press_and_release", async () => {
  // Scenario: the first click re-renders the diagram; if the new drawing replaces the nodes while the second press is held, the browser sends no dblclick.
  await resetEditorFixture();
  await setEditorSource(SEARCH_FIXTURE);
  await waitMilliseconds(500);
  // Step: make every Mermaid render take 150 ms longer, so the render of the first click ends about 200 ms after that click.
  await executeExpression(`(() => {
    window.__originalMermaidRender = mermaid.render;
    mermaid.render = async (...args) => {
      const result = await window.__originalMermaidRender.apply(mermaid, args);
      await new Promise((resolve) => setTimeout(resolve, 150));
      return result;
    };
  })()`);
  const center = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const node = document.querySelector('#diagram [id*="flowchart-B_MIDDLE-"]');
    node.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })())`));
  async function pressMouse(clickCount: number) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount });
  }
  async function releaseMouse(clickCount: number) {
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount });
  }
  // Step: first click, then press again 40 ms later and hold the button for 300 ms: the slow render ends during that hold.
  await pressMouse(1);
  await releaseMouse(1);
  await waitMilliseconds(40);
  await pressMouse(2);
  await waitMilliseconds(300);
  await releaseMouse(2);
  await waitMilliseconds(600);
  const selection = JSON.parse(await executeExpression(`JSON.stringify({
    activeId: document.activeElement.id,
    value: document.getElementById('nodeTextInput').value,
    start: document.getElementById('nodeTextInput').selectionStart,
    end: document.getElementById('nodeTextInput').selectionEnd,
  })`));
  await executeExpression("mermaid.render = window.__originalMermaidRender");
  // Step: the Node Text input has focus and all of its text is selected.
  assert.equal(selection.activeId, "nodeTextInput");
  assert.equal(selection.value, "Middle");
  assert.equal(selection.start, 0);
  assert.equal(selection.end, selection.value.length);
});
