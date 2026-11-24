import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
registerBrowserHooks(import.meta.url, openEditorDrawer);
const SOURCE = [
    "flowchart TD",
    '  B_ONE["Short"]',
    '  Q_ONE{{"Does it work?"}}',
    '  Q_CHOICE_ONE_Y["Yes"]',
    '  Q_CHOICE_ONE_N["No"]',
    "  B_ONE --> Q_ONE",
    "  Q_ONE --> Q_CHOICE_ONE_Y",
    "  Q_ONE --> Q_CHOICE_ONE_N",
].join("\n");
const SIZE_LINE_B_ONE = "%% ==size==: B_ONE 500 150";
const SIZE_LINE_Q_ONE = "%% ==size==: Q_ONE 600 160";
const ALIGN_LINE_Q_ONE = "%% ==align==: Q_ONE left center";
// The automatic box is the text box plus 4 px on each side.
const AUTOMATIC_PADDING_PX = 8;
const TOLERANCE_PX = 1.5;
async function loadSource(extraLines: string[]) {
    await resetEditorFixture();
    await setEditorSource([SOURCE, ...extraLines].join("\n"));
    await waitMilliseconds(700);
}
type Point = { x: number; y: number };
// Where to double click: "empty" is 12 px inside the left edge of the shape at its middle height; "text" is the middle of the text.
// "padding" is 2 px inside the left edge: the only empty place of a block without a size line, whose padding is 4 px.
async function findClickPoint(id: string, place: "empty" | "text" | "padding"): Promise<Point> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const node = document.querySelector('#diagram g.node[id*="flowchart-${id}-"]');
        node.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        const shapeBox = node.querySelector('rect, polygon').getBoundingClientRect();
        const textBox = node.querySelector('.nodeLabel').getBoundingClientRect();
        if ('${place}' === 'empty')
            return { x: shapeBox.left + 12, y: (shapeBox.top + shapeBox.bottom) / 2 };
        if ('${place}' === 'padding')
            return { x: shapeBox.left + 2, y: (shapeBox.top + shapeBox.bottom) / 2 };
        return { x: (textBox.left + textBox.right) / 2, y: (textBox.top + textBox.bottom) / 2 };
    })())`));
}
async function doubleClickWithMouse(point: Point) {
    for (const clickCount of [1, 2]) {
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount });
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount });
        await waitMilliseconds(40);
    }
    await executeExpression("window.editorActionPromise");
    await waitMilliseconds(700);
}
async function readSourceLines(): Promise<string[]> {
    return (await executeExpression("codeBox.value")).split("\n");
}
async function readBoxAndTextBox(id: string, shapeTag: string) {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const node = document.querySelector('#diagram g.node[id*="flowchart-${id}-"]');
        const shapeBox = node.querySelector('${shapeTag}').getBoundingClientRect();
        const textBox = node.querySelector('.nodeLabel div').getBoundingClientRect();
        return { width: shapeBox.width, height: shapeBox.height, textWidth: textBox.width, textHeight: textBox.height };
    })())`));
}
test("test_double_click_outside_the_text_of_a_sized_block_removes_its_size_line_and_draws_the_automatic_box", async () => {
    await loadSource([SIZE_LINE_B_ONE]);
    await doubleClickWithMouse(await findClickPoint("B_ONE", "empty"));
    const lines = await readSourceLines();
    assert.ok(!lines.includes(SIZE_LINE_B_ONE), lines.join("|"));
    const measured = await readBoxAndTextBox("B_ONE", "rect");
    console.log(`MEASURED after reset: ${JSON.stringify(measured)}`);
    assert.ok(Math.abs(measured.width - (measured.textWidth + AUTOMATIC_PADDING_PX)) < TOLERANCE_PX, JSON.stringify(measured));
    assert.ok(Math.abs(measured.height - (measured.textHeight + AUTOMATIC_PADDING_PX)) < TOLERANCE_PX, JSON.stringify(measured));
});
test("test_double_click_outside_the_text_does_not_open_the_node_text_editor", async () => {
    await loadSource([SIZE_LINE_B_ONE]);
    await doubleClickWithMouse(await findClickPoint("B_ONE", "empty"));
    assert.notEqual(await executeExpression("document.activeElement.id"), "nodeTextInput");
});
test("test_undo_restores_the_size_line_after_the_reset_and_redo_removes_it_again", async () => {
    await loadSource([SIZE_LINE_B_ONE]);
    await doubleClickWithMouse(await findClickPoint("B_ONE", "empty"));
    await executeExpression("window.applyEditorUndo(); window.editorActionPromise");
    await waitMilliseconds(600);
    assert.ok((await readSourceLines()).includes(SIZE_LINE_B_ONE));
    await executeExpression("window.applyEditorRedo(); window.editorActionPromise");
    await waitMilliseconds(600);
    assert.ok(!(await readSourceLines()).includes(SIZE_LINE_B_ONE));
});
test("test_double_click_on_the_text_keeps_the_size_line_and_opens_the_node_text_editor", async () => {
    await loadSource([SIZE_LINE_B_ONE]);
    await doubleClickWithMouse(await findClickPoint("B_ONE", "text"));
    assert.ok((await readSourceLines()).includes(SIZE_LINE_B_ONE));
    assert.equal(await executeExpression("document.activeElement.id"), "nodeTextInput");
});
test("test_double_click_outside_the_text_of_a_block_without_a_size_line_changes_nothing_and_adds_no_undo_step", async () => {
    await loadSource([]);
    // The first click of the double click selects the node, and the save writes the selected node into the metadata block at the end; the diagram part stays the same.
    const readDiagramPart = async () => (await readSourceLines()).slice(0, SOURCE.split("\n").length).join("\n");
    const historyLengthBefore = await executeExpression("editorHistory.length");
    await doubleClickWithMouse(await findClickPoint("B_ONE", "padding"));
    assert.equal(await readDiagramPart(), SOURCE);
    assert.equal(await executeExpression("editorHistory.length"), historyLengthBefore);
    assert.notEqual(await executeExpression("document.activeElement.id"), "nodeTextInput");
});
test("test_double_click_outside_the_text_of_a_hexagon_decision_removes_its_size_line_and_keeps_its_align_line", async () => {
    await loadSource([SIZE_LINE_Q_ONE, ALIGN_LINE_Q_ONE]);
    await doubleClickWithMouse(await findClickPoint("Q_ONE", "empty"));
    const lines = await readSourceLines();
    assert.ok(!lines.includes(SIZE_LINE_Q_ONE), lines.join("|"));
    assert.ok(lines.includes(ALIGN_LINE_Q_ONE), lines.join("|"));
    assert.notEqual(await executeExpression("document.activeElement.id"), "nodeTextInput");
});
