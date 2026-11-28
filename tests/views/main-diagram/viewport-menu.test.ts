import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
// import { executeExpression, send, waitMilliseconds } from "../../cdp.ts";
import { executeExpression, send, waitForEditorAction, waitForExpression } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { SEARCH_FIXTURE } from "../../fixtures.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

async function rightClickViewport() {
  // Scenario: press and release the right mouse button near the top left corner of the diagram viewport.
  // const point = JSON.parse(await executeExpression(`JSON.stringify((() => {
  const point: { x: number; y: number } = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const rect = document.getElementById('output').getBoundingClientRect();
    return { x: rect.left + 30, y: rect.top + 30 };
  })())`));
    await executeExpression("document.getElementById('viewportMenu').hidden = true");
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "right", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "right", clickCount: 1 });
  // await waitMilliseconds(200);
    await waitForExpression(`!document.getElementById('viewportMenu').hidden`);
}

async function isViewportMenuShown() {
  return executeExpression("!document.getElementById('viewportMenu').hidden");
}

async function startViewportMenuTest() {
  await resetEditorFixture();
  await setEditorSource(SEARCH_FIXTURE);
}

test("test_right_clicking_the_viewport_opens_a_menu_with_the_two_add_block_choices", async () => {
  await startViewportMenuTest();
  // Step: before the right click the menu is hidden.
  assert.equal(await isViewportMenuShown(), false);
  // Step: right click empty space in the viewport; the menu shows both choices.
  await rightClickViewport();
  assert.equal(await isViewportMenuShown(), true);
  // const labels = JSON.parse(await executeExpression("JSON.stringify(Array.from(document.querySelectorAll('#viewportMenu button')).map(button => button.textContent))"));
  const labels: string[] = JSON.parse(await executeExpression("JSON.stringify(Array.from(document.querySelectorAll('#viewportMenu button')).map(button => button.textContent))"));
  assert.deepEqual(labels, ["Add Decision Block", "Add Static Block"]);
});

test("test_add_static_block_from_the_menu_adds_a_node_with_no_edges_and_selects_its_text", async () => {
  await startViewportMenuTest();
  await rightClickViewport();
  // Step: choose Add Static Block.
  await executeExpression("document.getElementById('addStaticBlockMenuBtn').click()");
  // await waitMilliseconds(800);
    await waitForEditorAction();
  // Step: the source has the new node and no edge touches it.
  // const source = await executeExpression("codeBox.value");
  const source = await executeExpression<string>("codeBox.value");
  assert.ok(source.includes('B_NEW_1["New static block"]'));
  assert.equal(source.includes("--> B_NEW_1"), false);
  assert.equal(source.includes("B_NEW_1 -->"), false);
  // Step: the node is selected, the menu is closed, and the Node Text input has all its text selected.
  assert.equal(await executeExpression("document.getElementById('selectedNode').textContent"), "B_NEW_1");
  assert.equal(await isViewportMenuShown(), false);
  assert.equal(await executeExpression("document.activeElement.id"), "nodeTextInput");
  assert.equal(await executeExpression("document.getElementById('nodeTextInput').selectionEnd - document.getElementById('nodeTextInput').selectionStart"), "New static block".length);
});

test("test_add_decision_block_from_the_menu_adds_a_question_with_yes_and_no_choices_and_no_incoming_edge", async () => {
  await startViewportMenuTest();
  await rightClickViewport();
  // Step: choose Add Decision Block.
  await executeExpression("document.getElementById('addDecisionBlockMenuBtn').click()");
  // await waitMilliseconds(800);
    await waitForEditorAction();
  // Step: the source has the question, its two choices, and only the two edges out of the question.
  // const source = await executeExpression("codeBox.value");
  const source = await executeExpression<string>("codeBox.value");
  assert.ok(source.includes('Q_NEW_1{{"New Decision"}}'));
  assert.ok(source.includes('Q_CHOICE_NEW_1_Y["Yes"]'));
  assert.ok(source.includes('Q_CHOICE_NEW_1_N["No"]'));
  assert.ok(source.includes("Q_NEW_1 --> Q_CHOICE_NEW_1_Y"));
  assert.ok(source.includes("Q_NEW_1 --> Q_CHOICE_NEW_1_N"));
  assert.equal(source.includes("--> Q_NEW_1\n"), false);
  // Step: the question is selected and its Node Text input has all its text selected.
  assert.equal(await executeExpression("document.getElementById('selectedNode').textContent"), "Q_NEW_1");
  assert.equal(await executeExpression("document.activeElement.id"), "nodeTextInput");
});

test("test_the_menu_closes_on_escape_and_on_a_click_elsewhere", async () => {
  await startViewportMenuTest();
  // Step: Escape closes the open menu.
  await rightClickViewport();
  assert.equal(await isViewportMenuShown(), true);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  // await waitMilliseconds(100);
    await waitForExpression(`document.getElementById('viewportMenu').hidden`);
  assert.equal(await isViewportMenuShown(), false);
  // Step: a left click elsewhere closes the open menu.
  await rightClickViewport();
  assert.equal(await isViewportMenuShown(), true);
  await executeExpression("document.getElementById('output').click()");
  assert.equal(await isViewportMenuShown(), false);
});
