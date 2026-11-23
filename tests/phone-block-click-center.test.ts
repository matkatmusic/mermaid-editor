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

async function clickPhoneRowWithMouse(id: string) {
    const center = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const row = document.querySelector('#phoneDiagram [data-node-id="${id}"]');
        row.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = row.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })())`));
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount: 1 });
}

async function measureCenterOffsetBetweenBlockAndMainView(id: string) {
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
    assert.ok(Math.abs(offsetBefore.vertical) > 200, `block must start off center, vertical offset was ${offsetBefore.vertical}`);    const highlightedBefore = await getHighlightedNodeIds();
    // Click the phone row with a real mouse, then wait for the smooth scroll to end.
    await clickPhoneRowWithMouse(CLICKED_BLOCK_ID);
    await waitMilliseconds(1500);
    // The block center is within tolerance of the main view center.
    const offsetAfter = await measureCenterOffsetBetweenBlockAndMainView(CLICKED_BLOCK_ID);
    assert.ok(Math.abs(offsetAfter.horizontal) <= CENTER_TOLERANCE_PIXELS, `horizontal offset was ${offsetAfter.horizontal}`);
    assert.ok(Math.abs(offsetAfter.vertical) <= CENTER_TOLERANCE_PIXELS, `vertical offset was ${offsetAfter.vertical}`);
    // The selected block did not change.
    assert.deepEqual(await getHighlightedNodeIds(), highlightedBefore);
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
