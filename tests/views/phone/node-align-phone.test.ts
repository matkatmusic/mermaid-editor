import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression, send, waitForRender, waitMilliseconds } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse } from "../../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const BODY = [
    "flowchart TD",
    '  B_START["Start"]',
    '  Q_A{{"Does it work?"}}',
    '  Q_CHOICE_A_Y["Yes"]',
    '  Q_CHOICE_A_N["No"]',
    '  B_END["End"]',
    "  B_START --> Q_A",
    "  Q_A --> Q_CHOICE_A_Y --> B_END",
    "  Q_A --> Q_CHOICE_A_N --> B_END",
].join("\n");

async function clickJustificationButtonWithMouse(justification: string) {
    // const center = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const center: { x: number; y: number } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const button = document.querySelector('#nodeAlignRow button[data-justification="${justification}"]');
        button.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = button.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })())`));
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount: 1 });
    await executeExpression("editorActionPromise");
    await waitForRender();
}

async function readPhoneTextAlign(id: string): Promise<string> {
    return executeExpression(`getComputedStyle(document.querySelector('#phoneDiagram [data-node-id="${id}"]')).textAlign`);
}

test("test_a_block_with_no_align_line_has_centred_text_in_the_phone_view", async () => {
    // Step: three-node diagram with no align line.
    await resetEditorFixture();
    await setEditorSource(BODY);
    await waitMilliseconds(600);
    // Step: the block row and the question row of the phone view keep the present look: centred text.
    assert.equal(await readPhoneTextAlign("B_START"), "center");
    assert.equal(await readPhoneTextAlign("Q_A"), "center");
});

test("test_justify_left_and_right_in_the_inspector_move_the_phone_view_text_of_a_block_and_a_question", async () => {
    await resetEditorFixture();
    await setEditorSource(BODY);
    await waitMilliseconds(600);
    // Step: select the block with the mouse and click "Justify left" with the mouse.
    await clickNodeWithMouse("B_START");
    await clickJustificationButtonWithMouse("left");
    // Step: the phone view block row is drawn with left text; the question row is unchanged.
    assert.equal(await readPhoneTextAlign("B_START"), "left");
    assert.equal(await readPhoneTextAlign("Q_A"), "center");
    // Step: select the question and click "Justify right".
    await clickNodeWithMouse("Q_A");
    await clickJustificationButtonWithMouse("right");
    // Step: the question row is drawn with right text; the block row keeps left.
    assert.equal(await readPhoneTextAlign("Q_A"), "right");
    assert.equal(await readPhoneTextAlign("B_START"), "left");
});
