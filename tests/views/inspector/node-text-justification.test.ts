import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
// import { executeExpression, send, waitForRender, waitMilliseconds } from "../../cdp.ts";
import { executeExpression, send, waitForRender } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse } from "../../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const TWO_BLOCKS = ["flowchart TD", '  B_START["Start"]', '  B_END["End"]', "  B_START --> B_END"].join("\n");

async function loadTwoBlocks() {
    await resetEditorFixture();
    await setEditorSource(TWO_BLOCKS);
    // await waitMilliseconds(600);
}

async function getNodeTextAlign(): Promise<string> {
    return executeExpression("getComputedStyle(document.getElementById('nodeTextInput')).textAlign");
}

async function clickJustificationButtonWithMouse(justification: string) {
    // const center = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const center: { x: number; y: number } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const button = document.querySelector('#nodeAlignRow button[data-justification="${justification}"]');
        const rect = button.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })())`));
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount: 1 });
    await executeExpression("editorActionPromise");
    await waitForRender();
}

test("test_node_text_box_is_centered_for_a_block_with_no_justification_line", async () => {
    // Step: select a block that has no justification line.
    await loadTwoBlocks();
    await clickNodeWithMouse("B_START");
    // Step: the Node text box centers its text.
    assert.equal(await getNodeTextAlign(), "center");
});

test("test_node_text_box_follows_a_click_on_a_justification_button", async () => {
    // Step: select a block and click Justify left.
    await loadTwoBlocks();
    await clickNodeWithMouse("B_START");
    await clickJustificationButtonWithMouse("left");
    // Step: the Node text box aligns left at once.
    assert.equal(await getNodeTextAlign(), "left");
    // Step: click Justify right.
    await clickJustificationButtonWithMouse("right");
    assert.equal(await getNodeTextAlign(), "right");
});

test("test_node_text_box_follows_the_justification_of_the_newly_selected_block", async () => {
    // Step: B_START is justified left, B_END has no justification line.
    await loadTwoBlocks();
    await clickNodeWithMouse("B_START");
    await clickJustificationButtonWithMouse("left");
    // Step: select B_END, then B_START again.
    await clickNodeWithMouse("B_END");
    assert.equal(await getNodeTextAlign(), "center");
    await clickNodeWithMouse("B_START");
    assert.equal(await getNodeTextAlign(), "left");
});
