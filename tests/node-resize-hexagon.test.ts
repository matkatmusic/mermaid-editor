import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitForRender, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse, Modifier } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const BODY = [
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
].join("\n");
const SOURCE = `${BODY}\n%% ==size==: Q_A 400 120`;

interface Box {
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

// The outer box of the hexagon shape in svg units, which are px at 100% zoom.
async function readHexagonSize(id: string): Promise<{ width: number; height: number }> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const box = document.querySelector('#diagram g.node[id*="flowchart-${id}-"] polygon').getBBox();
        return { width: box.width, height: box.height };
    })())`));
}

async function getHexagonScreenBox(id: string): Promise<Box> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const node = document.querySelector('#diagram g.node[id*="flowchart-${id}-"]');
        node.scrollIntoView({ block: 'center', inline: 'center' });
        const box = node.querySelector('polygon').getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    })())`));
}

async function readCursor(): Promise<string> {
    return executeExpression("getComputedStyle(document.getElementById('output')).cursor");
}

async function readSizeLine(id: string): Promise<string | undefined> {
    const lines = (await executeExpression("codeBox.value")).split("\n");
    const sizeLines = lines.filter((line: string) => line.startsWith(`%% ==size==: ${id} `));
    assert.ok(sizeLines.length <= 1, sizeLines.join("|"));
    return sizeLines[0];
}

async function moveMouse(x: number, y: number, buttons = 0) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons });
}

async function dragMouse(from: { x: number; y: number }, to: { x: number; y: number }) {
    await moveMouse(from.x, from.y);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: from.x, y: from.y, button: "left", buttons: 1, clickCount: 1 });
    await moveMouse((from.x + to.x) / 2, (from.y + to.y) / 2, 1);
    await moveMouse(to.x, to.y, 1);
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: to.x, y: to.y, button: "left", buttons: 0, clickCount: 1 });
    await executeExpression("window.editorActionPromise");
    await waitForRender();
    await waitMilliseconds(300);
}

test("test_a_sized_hexagon_renders_with_the_stored_size_as_its_outer_box", async () => {
    // Scenario: the numbers of the size line are the width and height of the whole hexagon, points included.
    for (const [width, height] of [[400, 120], [350, 130], [500, 160]]) {
        await loadSource(`${BODY}\n%% ==size==: Q_A ${width} ${height}`);
        const box = await readHexagonSize("Q_A");
        assert.ok(Math.abs(box.width - width) < 1.5, JSON.stringify({ width, height, box }));
        assert.ok(Math.abs(box.height - height) < 1.5, JSON.stringify({ width, height, box }));
    }
});

test("test_a_sized_hexagon_never_gets_smaller_than_25_zero_characters_of_text_and_2_rows", async () => {
    await loadSource(`${BODY}\n%% ==size==: Q_A 50 20`);
    const box = await readHexagonSize("Q_A");
    // The text area is 209.77 px wide and 48 px high; the outer box adds 70 px of height, 32 px of width and the two points (4/7 of the outer height).
    assert.ok(Math.abs(box.height - 118) < 1.5, JSON.stringify(box));
    assert.ok(Math.abs(box.width - (209.77 + 32 + 118 * 4 / 7)) < 1.5, JSON.stringify(box));
});

test("test_hexagon_decisions_show_the_resize_cursor_only_at_the_four_grab_places", async () => {
    await loadSource(SOURCE);
    const box = await getHexagonScreenBox("Q_A");
    const middleX = (box.left + box.right) / 2;
    const middleY = (box.top + box.bottom) / 2;
    const slant = (box.bottom - box.top) / 4;
    const expectations: [string, number, number, string][] = [
        ["top flat edge", middleX, box.top + 2, "ns-resize"],
        ["bottom flat edge", middleX, box.bottom - 2, "ns-resize"],
        ["left point", box.left + 2, middleY, "ew-resize"],
        ["right point", box.right - 2, middleY, "ew-resize"],
        ["middle of the hexagon", middleX, middleY, "auto"],
        ["top-left corner of the box, which is outside the hexagon", box.left + 2, box.top + 2, "auto"],
        ["middle of the upper left slanted edge", box.left + slant / 2, box.top + (box.bottom - box.top) / 4, "auto"],
        ["far outside", box.right + 40, middleY, "auto"],
    ];
    for (const [place, x, y, cursor] of expectations) {
        await moveMouse(x, y);
        assert.equal(await readCursor(), cursor, place);
    }
});

test("test_a_diamond_decision_never_shows_a_resize_cursor", async () => {
    await loadSource(SOURCE);
    const box = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const node = document.querySelector('#diagram g.node[id*="flowchart-Q_D-"]');
        node.scrollIntoView({ block: 'center', inline: 'center' });
        const box = node.querySelector('polygon').getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    })())`));
    const middleX = (box.left + box.right) / 2;
    const middleY = (box.top + box.bottom) / 2;
    for (const [x, y] of [[middleX, box.top + 2], [middleX, box.bottom - 2], [box.left + 2, middleY], [box.right - 2, middleY]]) {
        await moveMouse(x, y);
        assert.equal(await readCursor(), "auto");
    }
});

test("test_dragging_the_top_flat_edge_changes_only_the_height", async () => {
    await loadSource(SOURCE);
    const before = await readHexagonSize("Q_A");
    const box = await getHexagonScreenBox("Q_A");
    const middleX = (box.left + box.right) / 2;
    await dragMouse({ x: middleX, y: box.top + 2 }, { x: middleX, y: box.top + 2 - 40 });
    const after = await readHexagonSize("Q_A");
    assert.ok(Math.abs(after.height - (before.height + 40)) < 1.5, JSON.stringify({ before, after }));
    assert.ok(Math.abs(after.width - before.width) < 1.5, JSON.stringify({ before, after }));
    assert.equal(await readSizeLine("Q_A"), "%% ==size==: Q_A 400 160");
});

test("test_dragging_the_right_point_changes_only_the_width", async () => {
    await loadSource(SOURCE);
    const before = await readHexagonSize("Q_A");
    const box = await getHexagonScreenBox("Q_A");
    const middleY = (box.top + box.bottom) / 2;
    await dragMouse({ x: box.right - 2, y: middleY }, { x: box.right - 2 + 60, y: middleY });
    const after = await readHexagonSize("Q_A");
    assert.ok(Math.abs(after.width - (before.width + 60)) < 1.5, JSON.stringify({ before, after }));
    assert.ok(Math.abs(after.height - before.height) < 1.5, JSON.stringify({ before, after }));
    assert.equal(await readSizeLine("Q_A"), "%% ==size==: Q_A 460 120");
});

test("test_dragging_the_left_point_to_the_left_makes_the_hexagon_wider", async () => {
    await loadSource(SOURCE);
    const box = await getHexagonScreenBox("Q_A");
    const middleY = (box.top + box.bottom) / 2;
    await dragMouse({ x: box.left + 2, y: middleY }, { x: box.left + 2 - 50, y: middleY });
    assert.equal(await readSizeLine("Q_A"), "%% ==size==: Q_A 450 120");
});

test("test_a_hexagon_drag_cannot_go_below_the_minimum_and_undo_restores_the_size", async () => {
    await loadSource(SOURCE);
    const box = await getHexagonScreenBox("Q_A");
    const middleX = (box.left + box.right) / 2;
    await dragMouse({ x: middleX, y: box.bottom - 2 }, { x: middleX, y: box.bottom - 2 - 400 });
    const after = await readHexagonSize("Q_A");
    assert.ok(Math.abs(after.height - 118) < 1.5, JSON.stringify(after));
    await executeExpression("window.applyEditorUndo(); window.editorActionPromise");
    await waitMilliseconds(500);
    assert.equal(await readSizeLine("Q_A"), "%% ==size==: Q_A 400 120");
});

test("test_switching_a_hexagon_to_a_diamond_removes_its_size_line_in_one_history_entry", async () => {
    await loadSource(SOURCE);
    await clickNodeWithMouse("Q_A");
    await executeExpression("document.getElementById('decisionShapeSwitch').click(); window.editorActionPromise");
    await waitMilliseconds(600);
    const source: string = await executeExpression("codeBox.value");
    assert.ok(source.includes('  Q_A{"Does it work?"}'), source);
    assert.equal(await readSizeLine("Q_A"), undefined);
    await executeExpression("window.applyEditorUndo(); window.editorActionPromise");
    await waitMilliseconds(500);
    const restored: string = await executeExpression("codeBox.value");
    assert.ok(restored.includes('  Q_A{{"Does it work?"}}'), restored);
    assert.equal(await readSizeLine("Q_A"), "%% ==size==: Q_A 400 120");
});

test("test_switching_a_diamond_to_a_hexagon_keeps_the_size_lines_of_other_nodes", async () => {
    await loadSource(`${BODY}\n%% ==size==: Q_A 400 120\n%% ==size==: B_START 300 100`);
    await clickNodeWithMouse("Q_D");
    await executeExpression("document.getElementById('decisionShapeSwitch').click(); window.editorActionPromise");
    await waitMilliseconds(600);
    assert.equal(await readSizeLine("Q_A"), "%% ==size==: Q_A 400 120");
    assert.equal(await readSizeLine("B_START"), "%% ==size==: B_START 300 100");
});

test("test_a_cmd_press_on_a_hexagon_point_does_not_resize", async () => {
    await loadSource(SOURCE);
    const box = await getHexagonScreenBox("Q_A");
    const middleY = (box.top + box.bottom) / 2;
    await moveMouse(box.right - 2, middleY);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.right - 2, y: middleY, button: "left", buttons: 1, clickCount: 1, modifiers: Modifier.Meta });
    await moveMouse(box.right - 2 + 60, middleY, 1);
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.right - 2 + 60, y: middleY, button: "left", buttons: 0, clickCount: 1, modifiers: Modifier.Meta });
    await waitMilliseconds(400);
    assert.equal(await readSizeLine("Q_A"), "%% ==size==: Q_A 400 120");
});
