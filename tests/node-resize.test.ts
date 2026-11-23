import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitForRender, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse, getHighlightedNodeIds, Modifier } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const SOURCE = [
    "flowchart TD",
    '  B_START["Start"]',
    '  Q_A{{"Does it work?"}}',
    '  Q_D{"Diamond?"}',
    '  Q_CHOICE_A_Y["Yes"]',
    '  Q_CHOICE_A_N["No"]',
    '  B_END["End"]',
    "  B_START --> Q_A",
    "  Q_A --> Q_CHOICE_A_Y --> Q_D",
    "  Q_A --> Q_CHOICE_A_N --> B_END",
    "  Q_D --> B_END",
    // Both sized blocks start above the minimum, so a drag changes only the dragged dimension.
    "%% ==size==: B_START 300 100",
    "%% ==size==: Q_CHOICE_A_Y 280 90",
].join("\n");

// 25 "0" characters measured in the page font is 209.77 px; the node box adds 32 px of padding to the text area.
const MINIMUM_NODE_WIDTH = 209.77 + 32;
// 2 text rows of 24 px each, plus 24 px of padding.
const MINIMUM_NODE_HEIGHT = 48 + 24;

interface ScreenBox {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

async function loadSource(source: string) {
    await resetEditorFixture();
    await setEditorSource(source);
    await waitMilliseconds(600);
}

// Scrolls the node to the middle of the pane and returns the screen box of its shape.
async function getNodeScreenBox(id: string): Promise<ScreenBox> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const node = document.querySelector('#diagram g.node[id*="flowchart-${id}-"]');
        node.scrollIntoView({ block: 'center', inline: 'center' });
        const box = node.querySelector('rect').getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    })())`));
}

// The size of the node shape in svg units, which are px at 100% zoom.
async function readNodeSize(id: string): Promise<{ width: number; height: number }> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const box = document.querySelector('#diagram g.node[id*="flowchart-${id}-"] rect').getBBox();
        return { width: box.width, height: box.height };
    })())`));
}

async function readCursor(): Promise<string> {
    return executeExpression("getComputedStyle(document.getElementById('output')).cursor");
}

async function readSourceLines(): Promise<string[]> {
    return (await executeExpression("codeBox.value")).split("\n");
}

// The size line of one node, or undefined when the node has none.
async function readSizeLine(id: string): Promise<string | undefined> {
    const sizeLines = (await readSourceLines()).filter((line) => line.startsWith(`%% ==size==: ${id} `));
    assert.ok(sizeLines.length <= 1, sizeLines.join("|"));
    return sizeLines[0];
}

async function moveMouse(x: number, y: number, buttons = 0) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons });
}

async function pressMouse(x: number, y: number, modifiers: number = Modifier.None) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, modifiers });
}

async function releaseMouse(x: number, y: number, modifiers: number = Modifier.None) {
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, modifiers });
    await executeExpression("window.editorActionPromise");
    await waitForRender();
    await waitMilliseconds(300);
}

async function pressAndMove(from: { x: number; y: number }, to: { x: number; y: number }, modifiers: number = Modifier.None) {
    await moveMouse(from.x, from.y);
    await pressMouse(from.x, from.y, modifiers);
    await moveMouse((from.x + to.x) / 2, (from.y + to.y) / 2, 1);
    await moveMouse(to.x, to.y, 1);
}

async function dragMouse(from: { x: number; y: number }, to: { x: number; y: number }, modifiers: number = Modifier.None) {
    await pressAndMove(from, to, modifiers);
    await releaseMouse(to.x, to.y, modifiers);
}

test("test_hovering_near_an_edge_or_corner_of_a_block_shows_the_matching_resize_cursor", async () => {
    await loadSource(SOURCE);
    const box = await getNodeScreenBox("B_START");
    const middleX = (box.left + box.right) / 2;
    const middleY = (box.top + box.bottom) / 2;
    const expectations: [string, number, number, string][] = [
        ["right edge", box.right - 2, middleY, "ew-resize"],
        ["left edge", box.left + 2, middleY, "ew-resize"],
        ["top edge", middleX, box.top + 2, "ns-resize"],
        ["bottom edge", middleX, box.bottom - 2, "ns-resize"],
        ["just outside the right edge", box.right + 3, middleY, "ew-resize"],
        ["top-left corner", box.left + 2, box.top + 2, "nwse-resize"],
        ["bottom-right corner", box.right - 2, box.bottom - 2, "nwse-resize"],
        ["top-right corner", box.right - 2, box.top + 2, "nesw-resize"],
        ["bottom-left corner", box.left + 2, box.bottom - 2, "nesw-resize"],
        ["middle of the node", middleX, middleY, "auto"],
        ["far outside the node", box.right + 40, middleY, "auto"],
    ];
    for (const [place, x, y, cursor] of expectations) {
        await moveMouse(x, y);
        assert.equal(await readCursor(), cursor, place);
    }
});

test("test_a_choice_block_shows_the_resize_cursor_and_a_diamond_decision_does_not", async () => {
    await loadSource(SOURCE);
    const choiceBox = await getNodeScreenBox("Q_CHOICE_A_Y");
    await moveMouse(choiceBox.right - 2, (choiceBox.top + choiceBox.bottom) / 2);
    assert.equal(await readCursor(), "ew-resize");
    const diamondBox = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const node = document.querySelector('#diagram g.node[id*="flowchart-Q_D-"]');
        node.scrollIntoView({ block: 'center', inline: 'center' });
        const box = node.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    })())`));
    await moveMouse(diamondBox.right - 2, (diamondBox.top + diamondBox.bottom) / 2);
    assert.equal(await readCursor(), "auto");
});

test("test_dragging_the_right_edge_changes_only_the_width_by_the_mouse_movement", async () => {
    await loadSource(SOURCE);
    const before = await readNodeSize("B_START");
    const box = await getNodeScreenBox("B_START");
    const middleY = (box.top + box.bottom) / 2;
    await dragMouse({ x: box.right - 2, y: middleY }, { x: box.right - 2 + 80, y: middleY });
    const after = await readNodeSize("B_START");
    assert.ok(Math.abs(after.width - (before.width + 80)) < 1.5, JSON.stringify({ before, after }));
    assert.ok(Math.abs(after.height - before.height) < 1.5, JSON.stringify({ before, after }));
    assert.equal(await readSizeLine("B_START"), "%% ==size==: B_START 380 100");
});

test("test_a_block_with_no_size_line_snaps_to_the_minimum_in_the_other_dimension_on_its_first_resize", async () => {
    // Scenario: B_END is drawn 48 px high, below the 2 row minimum; dragging its right edge makes it 72 px high.
    await loadSource(SOURCE);
    const before = await readNodeSize("B_END");
    const box = await getNodeScreenBox("B_END");
    const middleY = (box.top + box.bottom) / 2;
    await dragMouse({ x: box.right - 2, y: middleY }, { x: box.right - 2 + 200, y: middleY });
    const after = await readNodeSize("B_END");
    assert.ok(Math.abs(after.width - (before.width + 200)) < 1.5, JSON.stringify({ before, after }));
    assert.ok(Math.abs(after.height - MINIMUM_NODE_HEIGHT) < 1.5, JSON.stringify({ before, after }));
});

test("test_dragging_the_left_edge_to_the_left_makes_the_node_that_much_wider", async () => {
    await loadSource(SOURCE);
    const before = await readNodeSize("B_START");
    const box = await getNodeScreenBox("B_START");
    const middleY = (box.top + box.bottom) / 2;
    await dragMouse({ x: box.left + 2, y: middleY }, { x: box.left + 2 - 60, y: middleY });
    const after = await readNodeSize("B_START");
    assert.ok(Math.abs(after.width - (before.width + 60)) < 1.5, JSON.stringify({ before, after }));
});

test("test_dragging_the_bottom_right_corner_changes_both_dimensions", async () => {
    await loadSource(SOURCE);
    const before = await readNodeSize("Q_CHOICE_A_Y");
    const box = await getNodeScreenBox("Q_CHOICE_A_Y");
    await dragMouse({ x: box.right - 2, y: box.bottom - 2 }, { x: box.right - 2 + 70, y: box.bottom - 2 + 50 });
    const after = await readNodeSize("Q_CHOICE_A_Y");
    assert.ok(Math.abs(after.width - (before.width + 70)) < 1.5, JSON.stringify({ before, after }));
    assert.ok(Math.abs(after.height - (before.height + 50)) < 1.5, JSON.stringify({ before, after }));
});

test("test_a_live_outline_follows_the_mouse_during_the_drag_and_goes_away_on_release", async () => {
    await loadSource(SOURCE);
    const box = await getNodeScreenBox("B_START");
    const middleY = (box.top + box.bottom) / 2;
    await pressAndMove({ x: box.right - 2, y: middleY }, { x: box.right - 2 + 90, y: middleY });
    const outline = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const outline = document.getElementById('nodeResizeOutline');
        if (!outline) return null;
        const rect = outline.getBoundingClientRect();
        return { left: rect.left, width: rect.width };
    })())`));
    assert.ok(outline, "the outline exists during the drag");
    assert.ok(Math.abs(outline.left - box.left) < 1.5, JSON.stringify({ outline, box }));
    assert.ok(Math.abs(outline.width - (box.right - box.left + 90)) < 1.5, JSON.stringify({ outline, box }));
    assert.equal(await readSizeLine("B_START"), "%% ==size==: B_START 300 100", "nothing is written while the mouse moves");
    await releaseMouse(box.right - 2 + 90, middleY);
    assert.equal(await executeExpression("document.getElementById('nodeResizeOutline')"), null);
});

test("test_one_drag_is_one_history_entry_and_undo_restores_the_old_size", async () => {
    await loadSource(SOURCE);
    const before = await readNodeSize("B_START");
    const box = await getNodeScreenBox("B_START");
    const middleY = (box.top + box.bottom) / 2;
    await dragMouse({ x: box.right - 2, y: middleY }, { x: box.right - 2 + 80, y: middleY });
    assert.equal(await readSizeLine("B_START"), "%% ==size==: B_START 380 100");
    await executeExpression("window.applyEditorUndo(); window.editorActionPromise");
    await waitMilliseconds(500);
    assert.equal(await readSizeLine("B_START"), "%% ==size==: B_START 300 100");
    const restored = await readNodeSize("B_START");
    assert.ok(Math.abs(restored.width - before.width) < 1.5, JSON.stringify({ before, restored }));
});

test("test_a_drag_cannot_make_the_node_smaller_than_25_zero_characters_and_2_rows", async () => {
    await loadSource(SOURCE);
    const box = await getNodeScreenBox("B_START");
    const middleX = (box.left + box.right) / 2;
    const middleY = (box.top + box.bottom) / 2;
    await dragMouse({ x: box.right - 2, y: box.bottom - 2 }, { x: box.right - 2 - 400, y: box.bottom - 2 - 400 });
    const after = await readNodeSize("B_START");
    assert.ok(Math.abs(after.width - MINIMUM_NODE_WIDTH) < 1.5, JSON.stringify(after));
    assert.ok(Math.abs(after.height - MINIMUM_NODE_HEIGHT) < 1.5, JSON.stringify(after));
    const sizeLine = (await readSourceLines()).find((line) => line.includes("==size==: B_START"))!;
    const [, width, height] = sizeLine.match(/B_START (\d+) (\d+)/)!;
    assert.ok(Math.abs(Number(width) - MINIMUM_NODE_WIDTH) < 1.5, sizeLine);
    assert.ok(Math.abs(Number(height) - MINIMUM_NODE_HEIGHT) < 1.5, sizeLine);
    assert.ok(middleX > 0 && middleY > 0);
});

test("test_the_drag_amount_is_divided_by_the_zoom", async () => {
    // Scenario: at 150% zoom a mouse movement of 90 screen px is 60 px of node size.
    await loadSource(SOURCE);
    for (let attempt = 0; attempt < 30; attempt++) {
        const level = await executeExpression("document.getElementById('zoomLevel').textContent");
        if (level === "150%")
            break;
        await executeExpression("document.getElementById('zoomInBtn').click()");
    }
    assert.equal(await executeExpression("document.getElementById('zoomLevel').textContent"), "150%");
    await waitMilliseconds(300);
    const before = await readNodeSize("B_START");
    const box = await getNodeScreenBox("B_START");
    const middleY = (box.top + box.bottom) / 2;
    await dragMouse({ x: box.right - 2, y: middleY }, { x: box.right - 2 + 90, y: middleY });
    const after = await readNodeSize("B_START");
    assert.ok(Math.abs(after.width - (before.width + 60)) < 1.5, JSON.stringify({ before, after }));
});

test("test_a_plain_click_still_selects_and_a_press_on_an_edge_without_movement_selects_without_resizing", async () => {
    await loadSource(SOURCE);
    await clickNodeWithMouse("B_START");
    assert.deepEqual(await getHighlightedNodeIds(), ["B_START"]);
    const box = await getNodeScreenBox("B_END");
    const middleY = (box.top + box.bottom) / 2;
    await moveMouse(box.right - 2, middleY);
    await pressMouse(box.right - 2, middleY);
    await releaseMouse(box.right - 2, middleY);
    assert.deepEqual(await getHighlightedNodeIds(), ["B_END"]);
    assert.equal(await readSizeLine("B_END"), undefined);
});

test("test_a_resize_does_not_swallow_the_next_click", async () => {
    await loadSource(SOURCE);
    const box = await getNodeScreenBox("B_START");
    const middleY = (box.top + box.bottom) / 2;
    await dragMouse({ x: box.right - 2, y: middleY }, { x: box.right - 2 + 40, y: middleY });
    await clickNodeWithMouse("B_END");
    assert.deepEqual(await getHighlightedNodeIds(), ["B_END"]);
});

test("test_cmd_click_still_multi_selects_and_a_cmd_press_on_an_edge_does_not_resize", async () => {
    await loadSource(SOURCE);
    await clickNodeWithMouse("B_START");
    await clickNodeWithMouse("B_END", Modifier.Meta);
    assert.deepEqual(await getHighlightedNodeIds(), ["B_END", "B_START"]);
    const box = await getNodeScreenBox("B_END");
    const middleY = (box.top + box.bottom) / 2;
    await dragMouse({ x: box.right - 2, y: middleY }, { x: box.right - 2 + 60, y: middleY }, Modifier.Meta);
    assert.equal(await readSizeLine("B_END"), undefined);
});

test("test_a_drag_that_starts_in_the_middle_of_a_node_does_not_resize", async () => {
    await loadSource(SOURCE);
    const box = await getNodeScreenBox("B_START");
    const middleX = (box.left + box.right) / 2;
    const middleY = (box.top + box.bottom) / 2;
    await dragMouse({ x: middleX, y: middleY }, { x: middleX + 80, y: middleY + 40 });
    assert.equal(await readSizeLine("B_START"), "%% ==size==: B_START 300 100");
});

test("test_the_off_screen_arrow_heads_are_drawn_again_after_a_resize", async () => {
    const ids = Array.from({ length: 14 }, (_, index) => `B_N${index}`);
    const chain = ["flowchart TD", ...ids.map((id) => `  ${id}["Block ${id}"]`), `  ${ids.join(" --> ")}`, `  ${ids[13]} --> ${ids[0]}`].join("\n");
    await loadSource(`${chain}\n%% ==size==: B_N5 200 80`);
    // Scroll so the middle of the line from B_N5 to B_N6 sits on the bottom edge of the pane: that line then ends off screen.
    await executeExpression(`(() => {
        const output = document.getElementById('output');
        const visibleBottom = output.getBoundingClientRect().top + output.clientTop + output.clientHeight;
        const rect = document.querySelectorAll('#diagram path.flowchart-link')[5].getBoundingClientRect();
        output.scrollTop += rect.top + rect.height / 2 - visibleBottom;
    })()`);
    await waitMilliseconds(300);
    const headsBefore = await executeExpression("document.querySelectorAll('#diagram .offscreen-arrow-head').length");
    assert.ok(headsBefore > 0, "a line that leaves the view has an arrow head");
    const box = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const box = document.querySelector('#diagram g.node[id*="flowchart-B_N5-"] rect').getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    })())`));
    const middleY = (box.top + box.bottom) / 2;
    const sizeBefore = await readNodeSize("B_N5");
    await dragMouse({ x: box.right - 2, y: middleY }, { x: box.right - 2 + 50, y: middleY });
    assert.ok(Math.abs((await readNodeSize("B_N5")).width - (sizeBefore.width + 50)) < 1.5);
    const headsAfter = await executeExpression("document.querySelectorAll('#diagram .offscreen-arrow-head').length");
    assert.ok(headsAfter > 0, "the arrow heads exist again after the re-render");
});
