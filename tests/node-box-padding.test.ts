import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
registerBrowserHooks(import.meta.url, openEditorDrawer);
const SIXTY_CHARACTERS = "abcdefghi ".repeat(6).trim().padEnd(60, "x");
const HUNDRED_CHARACTERS = "abcdefghi ".repeat(10).trim().padEnd(100, "x");
const MINIMUM_PADDING_PX = 3;
const MAXIMUM_PADDING_PX = 5;
const TOLERANCE_PX = 1;
async function loadSource(source: string) {
    await resetEditorFixture();
    await setEditorSource(source);
    await waitMilliseconds(600);
}
function buildSource(label: string, extraLines: string[] = []) {
    return ["flowchart TD", `  B_ONE["${label}"]`, '  B_TWO["Two"]', "  B_ONE --> B_TWO", ...extraLines].join("\n");
}
type Measured = {
    box: { left: number; right: number; top: number; bottom: number; width: number; height: number };
    text: { left: number; right: number; top: number; bottom: number; width: number; height: number };
    textLines: Measured["box"];
    lineCount: number;
    columnWidthPx: number;
};
// The text box is the box of the label (as wide as its longest line, or 80 characters when it wraps); the box is the rectangle or the polygon of the node.
async function measureNode(id: string, shapeTag: string): Promise<Measured> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const node = document.querySelector('#diagram g.node[id*="flowchart-${id}-"]');
        const shapeBox = node.querySelector('${shapeTag}').getBoundingClientRect();
        const label = node.querySelector('.nodeLabel');
        const lineTops = new Set();
        let left = Infinity, right = -Infinity;
        const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
        for (let current = walker.nextNode(); current; current = walker.nextNode()) {
            const range = document.createRange();
            range.selectNodeContents(current);
            for (const rect of range.getClientRects()) {
                if (rect.width === 0)
                    continue;
                lineTops.add(Math.round(rect.top));
                left = Math.min(left, rect.left);
                right = Math.max(right, rect.right);
            }
        }
        const labelBox = label.querySelector('div').getBoundingClientRect();
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;visibility:hidden;width:80ch';
        label.appendChild(probe);
        const columnWidthPx = probe.getBoundingClientRect().width;
        probe.remove();
        const toBox = (l, r, t, b) => ({ left: l, right: r, top: t, bottom: b, width: r - l, height: b - t });
        return {
            box: toBox(shapeBox.left, shapeBox.right, shapeBox.top, shapeBox.bottom),
            text: toBox(labelBox.left, labelBox.right, labelBox.top, labelBox.bottom),
            textLines: toBox(left, right, labelBox.top, labelBox.bottom),
            lineCount: lineTops.size,
            columnWidthPx,
        };
    })())`));
}
function assertPaddingBetweenThreeAndFivePixels(measured: Measured) {
    const paddings = {
        left: measured.text.left - measured.box.left,
        right: measured.box.right - measured.text.right,
        top: measured.text.top - measured.box.top,
        bottom: measured.box.bottom - measured.text.bottom,
    };
    for (const [side, padding] of Object.entries(paddings)) {
        assert.ok(padding >= MINIMUM_PADDING_PX - TOLERANCE_PX && padding <= MAXIMUM_PADDING_PX + TOLERANCE_PX, `${side} padding ${padding}px: ${JSON.stringify(measured)}`);
    }
}
test("test_a_60_character_label_is_one_line_and_its_box_is_the_text_box_plus_4px_padding", async () => {
    await loadSource(buildSource(SIXTY_CHARACTERS));
    const measured = await measureNode("B_ONE", "rect");
    console.log(`MEASURED 60 characters: ${JSON.stringify(measured)}`);
    assert.equal(measured.lineCount, 1, JSON.stringify(measured));
    assertPaddingBetweenThreeAndFivePixels(measured);
});
test("test_a_100_character_label_wraps_into_two_lines_that_are_at_most_80_characters_wide", async () => {
    await loadSource(buildSource(HUNDRED_CHARACTERS));
    const measured = await measureNode("B_ONE", "rect");
    console.log(`MEASURED 100 characters: ${JSON.stringify(measured)}`);
    assert.equal(measured.lineCount, 2, JSON.stringify(measured));
    assert.ok(measured.text.width <= measured.columnWidthPx + TOLERANCE_PX, JSON.stringify(measured));
    assertPaddingBetweenThreeAndFivePixels(measured);
});
test("test_a_hexagon_decision_keeps_its_text_inside_the_polygon_with_the_same_wrap_width", async () => {
    await loadSource(["flowchart TD", `  Q_ONE{{"${HUNDRED_CHARACTERS}"}}`, '  B_TWO["Two"]', "  Q_ONE --> B_TWO"].join("\n"));
    const measured = await measureNode("Q_ONE", "polygon");
    console.log(`MEASURED hexagon: ${JSON.stringify(measured)}`);
    assert.equal(measured.lineCount, 2, JSON.stringify(measured));
    assert.ok(measured.text.width <= measured.columnWidthPx + TOLERANCE_PX, JSON.stringify(measured));
    assert.ok(measured.text.left >= measured.box.left - TOLERANCE_PX, JSON.stringify(measured));
    assert.ok(measured.text.right <= measured.box.right + TOLERANCE_PX, JSON.stringify(measured));
    // Mermaid (look neo) draws a hexagon 70 px higher than its label box and a label box cannot be less than 0 px high,
    // so the text box of a one-line hexagon can only be shrunk by 22 px: 48 px of vertical padding is the smallest that keeps the text centred.
    const topPadding = measured.text.top - measured.box.top;
    const bottomPadding = measured.box.bottom - measured.text.bottom;
    assert.ok(Math.abs(topPadding - bottomPadding) <= TOLERANCE_PX, `hexagon text is not centred: ${JSON.stringify(measured)}`);
    assert.ok(topPadding + bottomPadding <= 48 + TOLERANCE_PX, `hexagon vertical padding ${topPadding + bottomPadding}px: ${JSON.stringify(measured)}`);
});
test("test_a_stored_size_line_still_sets_the_box_size", async () => {
    await loadSource(buildSource(SIXTY_CHARACTERS, ['%% ==props==: {"blockId":"B_ONE","width":500,"height":150}']));
    const measured = await measureNode("B_ONE", "rect");
    console.log(`MEASURED stored size: ${JSON.stringify(measured)}`);
    assert.ok(Math.abs(measured.box.width - 500) < 1.5, JSON.stringify(measured));
    assert.ok(Math.abs(measured.box.height - 150) < 1.5, JSON.stringify(measured));
});
