import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { SEARCH_FIXTURE } from "./fixtures.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

async function doubleClickNodeWithMouse(id: string) {
  // Scenario: press and release the left mouse button twice at the center of the node, as a user does.
  const center = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const node = document.querySelector('#diagram [id*="flowchart-${id}-"]');
    node.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })())`));
  for (const clickCount of [1, 2]) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount });
    // A person's two clicks are about 150 ms apart.
    await waitMilliseconds(150);
  }
  await waitMilliseconds(800);
}

async function readNodeTextSelection() {
  return JSON.parse(await executeExpression(`JSON.stringify({
    activeId: document.activeElement.id,
    value: document.getElementById('nodeTextInput').value,
    start: document.getElementById('nodeTextInput').selectionStart,
    end: document.getElementById('nodeTextInput').selectionEnd,
  })`));
}

async function startDoubleClickTest() {
  await resetEditorFixture();
  await setEditorSource(SEARCH_FIXTURE);
}

test("test_double_clicking_a_block_node_selects_all_of_the_node_text_input", async () => {
  await startDoubleClickTest();
  // Step: double click the block B_MIDDLE with the mouse.
  await doubleClickNodeWithMouse("B_MIDDLE");
  // Step: the Node Text input has focus and all of its text is selected.
  const selection = await readNodeTextSelection();
  assert.equal(selection.value, "Middle");
  assert.equal(selection.activeId, "nodeTextInput");
  assert.equal(selection.start, 0);
  assert.equal(selection.end, selection.value.length);
});

test("test_double_clicking_a_node_of_a_large_diagram_selects_all_of_the_node_text_input", async () => {
  // Scenario: a large diagram renders slowly, so the render started by the first click ends after the double click.
  await executeExpression("loadDiagram('accountability.mmd')");
  await waitMilliseconds(1500);
  // Step: double click the question Q_THEM_DONE_SPEAKING with the mouse.
  await doubleClickNodeWithMouse("Q_THEM_DONE_SPEAKING");
  // Step: the Node Text input has focus and all of its text is selected.
  const selection = await readNodeTextSelection();
  assert.ok(selection.value.length > 0);
  assert.equal(selection.activeId, "nodeTextInput");
  assert.equal(selection.start, 0);
  assert.equal(selection.end, selection.value.length);
});

test("test_double_clicking_a_question_node_selects_all_of_the_node_text_input", async () => {
  await startDoubleClickTest();
  // Step: double click the question Q_FIRST with the mouse; a click on a question also re-renders the diagram.
  await doubleClickNodeWithMouse("Q_FIRST");
  // Step: the Node Text input has focus and all of its text is selected.
  const selection = await readNodeTextSelection();
  assert.equal(selection.value, "First decision");
  assert.equal(selection.activeId, "nodeTextInput");
  assert.equal(selection.start, 0);
  assert.equal(selection.end, selection.value.length);
});
