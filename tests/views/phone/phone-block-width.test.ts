import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression, waitMilliseconds } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const FENCE = "#96;#96;#96;";
const LONG_CODE_LINE = "const resultOfTheLongComputation = computeTheLongThing(firstArgument, secondArgument, thirdArgument, fourthArgument);";
const SOURCE = [
    "flowchart TD",
    `  B_CODE["Intro<br/>${FENCE}<br/>${LONG_CODE_LINE}<br/>${FENCE}"]`,
    '  B_SHORT["Short text"]',
    "  B_CODE --> B_SHORT",
].join("\n");

async function showBlocksInPhoneView() {
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    await waitMilliseconds(800);
}

// test("test_phone_block_is_as_wide_as_its_long_code_line", async () => {
//     // Step: show a block with a fenced code line of about 120 characters.
//     assert.ok(LONG_CODE_LINE.length >= 115);
//     await showBlocksInPhoneView();
//     // Step: measure the right edge of the block and the right edge of the code text.
//     const edges = JSON.parse(await executeExpression(`JSON.stringify((() => {
//         const block = document.querySelector('#phoneDiagram .phone-block[data-node-id="B_CODE"]');
//         const code = block.querySelector('.phone-code-block');
//         const codeRange = document.createRange();
//         codeRange.selectNodeContents(code);
//         return { blockRight: block.getBoundingClientRect().right, codeTextRight: codeRange.getBoundingClientRect().right };
//     })())`));
//     // Step: the block reaches at least as far right as the code text.
//     assert.ok(edges.blockRight >= edges.codeTextRight - 0.5, JSON.stringify(edges));
// });

test("test_phone_history_does_not_scroll_sideways_for_a_long_code_line", async () => {
    // Step: show a block with a fenced code line of about 120 characters.
    assert.ok(LONG_CODE_LINE.length >= 115);
    await showBlocksInPhoneView();
    // Step: measure the content width and the visible width of the phone history.
    // const widths = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const widths: { scrollWidth: number; clientWidth: number } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const history = document.querySelector('#phoneHistory');
        return { scrollWidth: history.scrollWidth, clientWidth: history.clientWidth };
    })())`));
    // Step: the phone history has nothing to scroll sideways.
    assert.ok(widths.scrollWidth <= widths.clientWidth, JSON.stringify(widths));
});

test("test_phone_block_with_a_long_code_line_scrolls_sideways_by_itself", async () => {
    // Step: show a block with a fenced code line of about 120 characters.
    await showBlocksInPhoneView();
    // Step: measure the block and its container.
    // const widths = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const widths: { blockWidth: number; expectedWidth: number; scrollWidth: number; clientWidth: number } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const block = document.querySelector('#phoneDiagram .phone-block[data-node-id="B_CODE"]');
        const parentStyle = getComputedStyle(block.parentElement);
        const parentContentWidth = block.parentElement.clientWidth - Number.parseFloat(parentStyle.paddingLeft) - Number.parseFloat(parentStyle.paddingRight);
        return { blockWidth: block.getBoundingClientRect().width, expectedWidth: parentContentWidth - 16, scrollWidth: block.scrollWidth, clientWidth: block.clientWidth };
    })())`));
    // Step: the block is as wide as its container minus 16 pixels.
    assert.ok(Math.abs(widths.blockWidth - widths.expectedWidth) <= 1, JSON.stringify(widths));
    // Step: the block has content to scroll sideways.
    assert.ok(widths.scrollWidth > widths.clientWidth, JSON.stringify(widths));
});

test("test_phone_block_with_short_text_is_as_wide_as_the_phone_view_minus_16_pixels", async () => {
    // Step: show a block with only short text.
    await showBlocksInPhoneView();
    // Step: the block is as wide as its container minus 16 pixels.
    // const widths = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const widths: { blockWidth: number; expectedWidth: number } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const block = document.querySelector('#phoneDiagram .phone-block[data-node-id="B_SHORT"]');
        const parentStyle = getComputedStyle(block.parentElement);
        const parentContentWidth = block.parentElement.clientWidth - Number.parseFloat(parentStyle.paddingLeft) - Number.parseFloat(parentStyle.paddingRight);
        return { blockWidth: block.getBoundingClientRect().width, expectedWidth: parentContentWidth - 16 };
    })())`));
    assert.ok(Math.abs(widths.blockWidth - widths.expectedWidth) <= 1, JSON.stringify(widths));
});
