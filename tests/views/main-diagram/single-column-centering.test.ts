import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
// import { executeExpression, send, waitMilliseconds } from "../../cdp.ts";
import { executeAndWaitForRender, executeExpression, send, waitForExpression } from "../../cdp.ts";

registerBrowserHooks(import.meta.url);

const COLUMN_TEXT = [
    "flowchart TD",
    '  B_ONE["one"]',
    '  B_TWO["two has a longer label than one"]',
    '  B_THREE["three"]',
    '  B_FOUR["four has a really quite long label text on it"]',
    '  B_FIVE["five"]',
    '  B_SIX["six has a medium label"]',
    '  B_SEVEN["seven"]',
    "  B_ONE --> B_TWO",
    "  B_TWO --> B_THREE",
    "  B_THREE --> B_FOUR",
    "  B_FOUR --> B_FIVE",
    "  B_FIVE --> B_SIX",
    "  B_SIX --> B_SEVEN",
].join("\n");

const COLUMN_WITH_SAVED_SCROLL_TEXT = COLUMN_TEXT + '\n%%%%====\n%% DO NOT MODIFY - AUTOMATICALLY GENERATED DURING EVERY SAVE\n%% {"lastSelectedNodeId":null,"outputScrollLeft":123,"outputScrollTop":45,"mainZoomPercent":100}\n%%%%====';

interface ColumnMeasurement {
    areaCenterX: number;
    scrollLeft: number;
    blocks: { id: string; left: number; centerX: number; right: number }[];
}

async function measureColumn(): Promise<ColumnMeasurement> {
    return await executeExpression(`(() => {
        const output = document.getElementById('output');
        const outputRect = output.getBoundingClientRect();
        const blocks = [...document.querySelectorAll('#diagram g.node')].map((node) => {
            const rect = node.getBoundingClientRect();
            return { id: node.id, left: rect.left, centerX: rect.left + rect.width / 2, right: rect.right };
        });
        return { areaCenterX: outputRect.left + output.clientWidth / 2, scrollLeft: output.scrollLeft, blocks };
    })()`);
}

function assertEveryBlockIsCentered(measurement: ColumnMeasurement) {
    assert.ok(measurement.blocks.length > 0, "no blocks drawn");
    for (const block of measurement.blocks)
        assert.ok(Math.abs(block.centerX - measurement.areaCenterX) <= 1, `block ${block.id} centre ${block.centerX} is not at the area centre ${measurement.areaCenterX}: ${JSON.stringify(measurement)}`);
}

async function openColumnLikeAUser(text: string) {
    await executeExpression(`showOpenedFile('/tmp/column-centering-probe.mmd', ${JSON.stringify(text)})`);
    // await waitMilliseconds(1000);
}

test("test_single_column_diagram_with_no_saved_scroll_is_centered_on_first_open", async () => {
    // Step: open a chain of 7 blocks with different label widths and no saved scroll position.
    await openColumnLikeAUser(COLUMN_TEXT);
    // Step: every block's centre is at the centre of the visible diagram area, within 1 pixel.
    assertEveryBlockIsCentered(await measureColumn());
});

test("test_saved_scroll_position_is_restored_as_saved", async () => {
    // Step: open the same chain with a saved horizontal scroll position of 123 and a vertical one of 45.
    await openColumnLikeAUser(COLUMN_WITH_SAVED_SCROLL_TEXT);
    // Step: the page scrolled to exactly the saved position; the centring rule did not override it.
    const measurement = await measureColumn();
    assert.ok(Math.abs(measurement.scrollLeft - 123) <= 0.5, `scrollLeft is ${measurement.scrollLeft}, saved was 123`);
    // assert.ok(Math.abs(await executeExpression("document.getElementById('output').scrollTop") - 45) <= 0.5);
    assert.ok(Math.abs(await executeExpression<number>("document.getElementById('output').scrollTop") - 45) <= 0.5);
});

test("test_search_match_block_is_centered_in_the_visible_area", async () => {
    // Step: open the chain, then search for the text of the fourth block.
    await openColumnLikeAUser(COLUMN_TEXT);
    // await executeExpression(`(() => { const input = document.getElementById('searchInput'); input.value = 'four has'; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    // await waitMilliseconds(1000);
    await executeAndWaitForRender(() => executeExpression(`(() => { const input = document.getElementById('searchInput'); input.value = 'four has'; input.dispatchEvent(new Event('input', { bubbles: true })); })()`));
    // Step: every block's centre is at the centre of the visible area (the searched block was moved there).
    assertEveryBlockIsCentered(await measureColumn());
});

test("test_column_stays_centered_after_a_zoom_change", async () => {
    // Step: open the chain and zoom in once.
    await openColumnLikeAUser(COLUMN_TEXT);
    await executeExpression("document.getElementById('zoomInBtn').click()");
    // await waitMilliseconds(500);
    // Step: every block's centre is still at the centre of the visible area.
    assertEveryBlockIsCentered(await measureColumn());
});

test("test_column_stays_centered_after_the_window_is_resized", async () => {
    // Step: open the chain, then make the window 300 pixels narrower.
    await openColumnLikeAUser(COLUMN_TEXT);
    // const width = await executeExpression("window.innerWidth");
    const width = await executeExpression<number>("window.innerWidth");
    // const height = await executeExpression("window.innerHeight");
    const height = await executeExpression<number>("window.innerHeight");
    await send("Emulation.setDeviceMetricsOverride", { width: width - 300, height, deviceScaleFactor: 1, mobile: false });
    // await waitMilliseconds(500);
    await waitForExpression(`window.innerWidth === ${width - 300}`);
    const measurement = await measureColumn();
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    // Step: every block's centre is still at the centre of the visible area.
    assertEveryBlockIsCentered(measurement);
});

test("test_new_document_block_is_centered_after_file_new", async () => {
    // Step: File > New.
    // await executeExpression("window.confirm = () => true; document.getElementById('newBtn').click()");
    // await waitMilliseconds(1000);
    await executeAndWaitForRender(() => executeExpression("window.confirm = () => true; document.getElementById('newBtn').click()"));
    // Step: the one new block's centre is at the centre of the visible diagram area, within 1 pixel.
    assertEveryBlockIsCentered(await measureColumn());
});
