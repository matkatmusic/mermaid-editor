import { test } from "node:test";
import assert from "node:assert/strict";
import { send, executeExpression, waitMilliseconds } from "./cdp.ts";
import { registerBrowserHooks } from "./browser-harness.ts";
import { openEditorDrawer, resetEditorFixture } from "./editor-helpers.ts";
import { getHighlightedNodeIds } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const CLICKED_BLOCK_ID = "B_STEP_20";
const CENTER_TOLERANCE_PIXELS = 20;

function buildLongChainDiagram(): string {
    const lines = ["flowchart TD"];
    for (let stepNumber = 1; stepNumber <= 40; stepNumber++) {
        lines.push(`  B_STEP_${stepNumber}["Step ${stepNumber}"]`);
    }
    for (let stepNumber = 1; stepNumber < 40; stepNumber++) {
        lines.push(`  B_STEP_${stepNumber} --> B_STEP_${stepNumber + 1}`);
    }
    lines.push("");
    return lines.join("\n");
}

async function openLongChainDiagram() {
    await resetEditorFixture();
    await executeExpression(`showOpenedFile('/tmp/phone-block-click-center.mmd', ${JSON.stringify(buildLongChainDiagram())})`);
    await waitMilliseconds(1000);
}

async function scrollMainViewToTop() {
    await executeExpression("(() => { const outputBox = document.getElementById('output'); outputBox.scrollTo({ left: 0, top: 0, behavior: 'instant' }); })()");
    await waitMilliseconds(300);
}

async function measurePhoneView(id: string): Promise<{ rowIds: string[]; clickedRowTop: number }> {
    return JSON.parse(await executeExpression(`JSON.stringify({
        rowIds: [...document.querySelectorAll('#phoneDiagram [data-node-id]')].map((row) => row.dataset.nodeId),
        clickedRowTop: document.querySelector('#phoneDiagram [data-node-id="${id}"]').getBoundingClientRect().top,
    })`));
}

// Presses and releases the mouse on the phone row; returns the Phone view as it was just before the press.
async function clickPhoneRowWithMouse(id: string) {
    // const center = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const center: { x: number; y: number } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const row = document.querySelector('#phoneDiagram [data-node-id="${id}"]');
        row.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = row.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })())`));
    const phoneViewBeforePress = await measurePhoneView(id);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount: 1 });
    return phoneViewBeforePress;
}

// async function measureCenterOffsetBetweenBlockAndMainView(id: string) {
async function measureCenterOffsetBetweenBlockAndMainView(id: string): Promise<{ horizontal: number; vertical: number }> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const outputRect = document.getElementById('output').getBoundingClientRect();
        const nodeRect = document.querySelector('#diagram [id*="flowchart-${id}-"]').getBoundingClientRect();
        return {
            horizontal: (nodeRect.left + nodeRect.width / 2) - (outputRect.left + outputRect.width / 2),
            vertical: (nodeRect.top + nodeRect.height / 2) - (outputRect.top + outputRect.height / 2),
        };
    })())`));
}

test("test_clicking_a_phone_block_row_scrolls_the_main_view_to_center_that_block", async () => {
    // Scenario: a tall diagram; the main view is scrolled away from B_STEP_20; a real click on its phone row centers it.
    await openLongChainDiagram();
    await scrollMainViewToTop();
    // The block starts far from the center of the main view.
    const offsetBefore = await measureCenterOffsetBetweenBlockAndMainView(CLICKED_BLOCK_ID);
    assert.ok(Math.abs(offsetBefore.vertical) > 200, `block must start off center, vertical offset was ${offsetBefore.vertical}`);
    assert.deepEqual(await getHighlightedNodeIds(), []);
    // Click the phone row with a real mouse, then wait for the smooth scroll to end.
    const phoneViewBefore = await clickPhoneRowWithMouse(CLICKED_BLOCK_ID);
    await waitMilliseconds(1500);
    // The block center is within tolerance of the main view center.
    const offsetAfter = await measureCenterOffsetBetweenBlockAndMainView(CLICKED_BLOCK_ID);
    assert.ok(Math.abs(offsetAfter.horizontal) <= CENTER_TOLERANCE_PIXELS, `horizontal offset was ${offsetAfter.horizontal}`);
    assert.ok(Math.abs(offsetAfter.vertical) <= CENTER_TOLERANCE_PIXELS, `vertical offset was ${offsetAfter.vertical}`);
    // The clicked block is now the one selected block, and the Node inspector shows it.
    assert.deepEqual(await getHighlightedNodeIds(), [CLICKED_BLOCK_ID]);
    assert.equal(await executeExpression("document.getElementById('selectedNode').textContent"), CLICKED_BLOCK_ID);
    assert.ok(CLICKED_BLOCK_ID.includes(await executeExpression("document.getElementById('nodeNameInput').value")));
    // The Phone view has the same rows, and the clicked row did not move.
    assert.deepEqual(await measurePhoneView(CLICKED_BLOCK_ID), phoneViewBefore);
});

test("test_clicking_the_chosen_choice_button_scrolls_the_main_view_to_center_and_select_that_choice", async () => {
    // Scenario: one decision is answered in the Phone view; the main view is scrolled away; a real click on the green chosen button selects that choice.
    const choiceId = "Q_CHOICE_ASK_YES";
    const lines = ["flowchart TD", '  B_START["Start"]', '  Q_ASK{"Ask?"}', `  ${choiceId}["Yes"]`, '  Q_CHOICE_ASK_NO["No"]', '  B_NO["No end"]'];
    for (let stepNumber = 1; stepNumber <= 40; stepNumber++)
        lines.push(`  B_STEP_${stepNumber}["Step ${stepNumber}"]`);
    lines.push("  B_START --> Q_ASK", `  Q_ASK --> ${choiceId} --> B_STEP_1`, "  Q_ASK --> Q_CHOICE_ASK_NO --> B_NO");
    for (let stepNumber = 1; stepNumber < 40; stepNumber++)
        lines.push(`  B_STEP_${stepNumber} --> B_STEP_${stepNumber + 1}`);
    lines.push("");
    await resetEditorFixture();
    await executeExpression(`showOpenedFile('/tmp/phone-chosen-choice-click.mmd', ${JSON.stringify(lines.join("\n"))})`);
    await waitMilliseconds(1000);
    // Answer the decision with a real click on the choice button.
    await clickPhoneRowWithMouse(choiceId);
    await waitMilliseconds(1500);
    assert.equal(await executeExpression(`document.querySelectorAll('#phoneDiagram .phone-choice-chosen[data-node-id="${choiceId}"]').length`), 1);
    // Scroll the main view to the bottom, so the choice is off center.
    await executeExpression("(() => { const outputBox = document.getElementById('output'); outputBox.scrollTo({ left: 0, top: outputBox.scrollHeight, behavior: 'instant' }); })()");
    await waitMilliseconds(300);
    const offsetBefore = await measureCenterOffsetBetweenBlockAndMainView(choiceId);
    assert.ok(Math.abs(offsetBefore.vertical) > 200, `choice must start off center, vertical offset was ${offsetBefore.vertical}`);
    // Click the green chosen button with a real mouse.
    await clickPhoneRowWithMouse(choiceId);
    await waitMilliseconds(1500);
    // The choice is centered in the main view and is the one selected node.
    const offsetAfter = await measureCenterOffsetBetweenBlockAndMainView(choiceId);
    assert.ok(Math.abs(offsetAfter.vertical) <= CENTER_TOLERANCE_PIXELS, `vertical offset was ${offsetAfter.vertical}`);
    assert.deepEqual(await getHighlightedNodeIds(), [choiceId]);
    // The click did not answer the decision again: the chosen button is still there.
    assert.equal(await executeExpression(`document.querySelectorAll('#phoneDiagram .phone-choice-chosen[data-node-id="${choiceId}"]').length`), 1);
});

test("test_clicking_a_phone_block_row_scrolls_the_main_view_back_up_to_center_that_block", async () => {
    // Scenario: the main view is scrolled past B_STEP_20 (to the bottom); a real click on its phone row scrolls back up.
    await openLongChainDiagram();
    await executeExpression("(() => { const outputBox = document.getElementById('output'); outputBox.scrollTo({ left: 0, top: outputBox.scrollHeight, behavior: 'instant' }); })()");
    await waitMilliseconds(300);
    const offsetBefore = await measureCenterOffsetBetweenBlockAndMainView(CLICKED_BLOCK_ID);
    assert.ok(offsetBefore.vertical < -200, `block must start above the center, vertical offset was ${offsetBefore.vertical}`);
    await clickPhoneRowWithMouse(CLICKED_BLOCK_ID);
    await waitMilliseconds(1500);
    const offsetAfter = await measureCenterOffsetBetweenBlockAndMainView(CLICKED_BLOCK_ID);
    assert.ok(Math.abs(offsetAfter.vertical) <= CENTER_TOLERANCE_PIXELS, `vertical offset was ${offsetAfter.vertical}`);
});
