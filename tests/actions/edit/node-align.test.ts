import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression, send, waitForRender, waitMilliseconds } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse, KeyName, pressKey } from "../../real-input.ts";

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

type Gaps = { left: number; right: number; top: number; bottom: number };

async function loadSource(source: string) {
    await resetEditorFixture();
    await setEditorSource(source);
    await waitMilliseconds(600);
}

async function readSourceLines(): Promise<string[]> {
    // return (await executeExpression("codeBox.value")).split("\n");
    return (await executeExpression<string>("codeBox.value")).split("\n");
}

async function readAlignLines(): Promise<string[]> {
    return (await readSourceLines()).filter((line) => line.includes("==props=="));
}

async function clickAlignButtonWithMouse(attributeName: "justification" | "alignment", value: string) {
    // const center = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const center: { x: number; y: number } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const button = document.querySelector('#nodeAlignRow button[data-${attributeName}="${value}"]');
        button.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = button.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })())`));
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount: 1 });
    await executeExpression("editorActionPromise");
    await waitForRender();
}

async function readPressedButtons(): Promise<string[]> {
    return JSON.parse(await executeExpression(`JSON.stringify([...document.querySelectorAll('#nodeAlignRow button[aria-pressed="true"]')].map((button) => button.dataset.justification ?? button.dataset.alignment))`));
}

// The gaps in px between the text lines of a node and the edges of its shape (rect or polygon).
async function readTextGaps(id: string): Promise<Gaps> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const node = document.querySelector('#diagram g.node[id*="flowchart-${id}-"]');
        const shape = node.querySelector('rect, polygon').getBoundingClientRect();
        const walker = document.createTreeWalker(node.querySelector('.nodeLabel'), NodeFilter.SHOW_TEXT);
        const text = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
        while (walker.nextNode()) {
            const range = document.createRange();
            range.selectNodeContents(walker.currentNode);
            const box = range.getBoundingClientRect();
            text.left = Math.min(text.left, box.left);
            text.right = Math.max(text.right, box.right);
            text.top = Math.min(text.top, box.top);
            text.bottom = Math.max(text.bottom, box.bottom);
        }
        return { left: text.left - shape.left, right: shape.right - text.right, top: text.top - shape.top, bottom: shape.bottom - text.bottom };
    })())`));
}

// The left edge in px of the first and of the last line of text of a node label.
async function readLineLeftEdges(id: string): Promise<{ first: number; last: number }> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const label = document.querySelector('#diagram g.node[id*="flowchart-${id}-"] .nodeLabel');
        const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
        const lefts = [];
        while (walker.nextNode()) {
            const range = document.createRange();
            range.selectNodeContents(walker.currentNode);
            lefts.push(range.getBoundingClientRect().left);
        }
        return { first: lefts[0], last: lefts[lefts.length - 1] };
    })())`));
}

async function selectBlockWithMouse(id: string) {
    await clickNodeWithMouse(id);
    await waitMilliseconds(300);
}

test("test_the_inspector_shows_centre_and_centre_pressed_for_a_block_without_an_align_line", async () => {
    await loadSource(BODY);
    await selectBlockWithMouse("B_START");
    assert.deepEqual((await readPressedButtons()).sort(), ["center", "center"]);
    // const label = await executeExpression("document.querySelector('#nodeAlignRow').textContent");
    const label = await executeExpression<string>("document.querySelector('#nodeAlignRow').textContent");
    assert.ok(label.includes("Text align"), label);
});

test("test_every_align_button_has_an_aria_label_and_an_svg_icon", async () => {
    await loadSource(BODY);
    await selectBlockWithMouse("B_START");
    // const report = JSON.parse(await executeExpression(`JSON.stringify([...document.querySelectorAll('#nodeAlignRow button')].map((button) => ({ label: button.getAttribute('aria-label'), pressed: button.getAttribute('aria-pressed'), hasSvg: !!button.querySelector('svg') })))`));
    const report: { label: string | null; pressed: string | null; hasSvg: boolean }[] = JSON.parse(await executeExpression(`JSON.stringify([...document.querySelectorAll('#nodeAlignRow button')].map((button) => ({ label: button.getAttribute('aria-label'), pressed: button.getAttribute('aria-pressed'), hasSvg: !!button.querySelector('svg') })))`));
    assert.equal(report.length, 6);
    for (const entry of report) {
        assert.ok(entry.label, JSON.stringify(entry));
        assert.ok(entry.pressed === "true" || entry.pressed === "false", JSON.stringify(entry));
        assert.ok(entry.hasSvg, JSON.stringify(entry));
    }
});

test("test_the_inspector_shows_the_stored_value_of_the_selected_block", async () => {
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_START","alignment":"bottom","justification":"right"}\n%% ==props==: {"blockId":"B_END","alignment":"top","justification":"left"}`);
    await selectBlockWithMouse("B_START");
    assert.deepEqual((await readPressedButtons()).sort(), ["bottom", "right"]);
    await selectBlockWithMouse("B_END");
    assert.deepEqual((await readPressedButtons()).sort(), ["left", "top"]);
});

test("test_a_mouse_click_on_justify_left_writes_the_align_line_and_presses_the_button", async () => {
    await loadSource(BODY);
    await selectBlockWithMouse("B_START");
    await clickAlignButtonWithMouse("justification", "left");
    assert.deepEqual(await readAlignLines(), ['  %% ==props==: {"blockId":"B_START","alignment":"center","justification":"left"}']);
    assert.deepEqual((await readPressedButtons()).sort(), ["center", "left"]);
});

test("test_a_mouse_click_on_align_bottom_keeps_the_stored_justification", async () => {
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_START","alignment":"center","justification":"right"}`);
    await selectBlockWithMouse("B_START");
    await clickAlignButtonWithMouse("alignment", "bottom");
    assert.deepEqual(await readAlignLines(), ['  %% ==props==: {"blockId":"B_START","alignment":"bottom","justification":"right"}']);
});

test("test_clicking_centre_in_both_rows_removes_the_align_line", async () => {
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_START","alignment":"bottom","justification":"right"}`);
    await selectBlockWithMouse("B_START");
    await clickAlignButtonWithMouse("justification", "center");
    assert.deepEqual(await readAlignLines(), ['  %% ==props==: {"blockId":"B_START","alignment":"bottom","justification":"center"}']);
    await clickAlignButtonWithMouse("alignment", "center");
    assert.deepEqual(await readAlignLines(), []);
    assert.deepEqual((await readPressedButtons()).sort(), ["center", "center"]);
});

test("test_undo_and_redo_of_an_align_click_restore_the_line_and_the_pressed_buttons", async () => {
    await loadSource(BODY);
    await selectBlockWithMouse("B_START");
    await clickAlignButtonWithMouse("justification", "right");
    assert.deepEqual(await readAlignLines(), ['  %% ==props==: {"blockId":"B_START","alignment":"center","justification":"right"}']);
    await executeExpression("window.applyEditorUndo(); window.editorActionPromise");
    await waitMilliseconds(500);
    assert.deepEqual(await readAlignLines(), []);
    // An undo clears the selection, as for every other inspector edit; select the block again to read its buttons.
    await selectBlockWithMouse("B_START");
    assert.deepEqual((await readPressedButtons()).sort(), ["center", "center"]);
    await executeExpression("window.applyEditorRedo(); window.editorActionPromise");
    await waitMilliseconds(500);
    assert.deepEqual(await readAlignLines(), ['  %% ==props==: {"blockId":"B_START","alignment":"center","justification":"right"}']);
    await selectBlockWithMouse("B_START");
    assert.deepEqual((await readPressedButtons()).sort(), ["center", "right"]);
});

test("test_a_sized_block_draws_its_text_left_or_right_or_centred", async () => {
    // Scenario: the block is 400 wide and the text is short, so the gaps show the justification.
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_START","alignment":"center","justification":"left","width":400,"height":120}`);
    const left = await readTextGaps("B_START");
    assert.ok(left.left < 40 && left.right > 200, JSON.stringify(left));
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_START","alignment":"center","justification":"right","width":400,"height":120}`);
    const right = await readTextGaps("B_START");
    assert.ok(right.right < 40 && right.left > 200, JSON.stringify(right));
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_START","width":400,"height":120}`);
    const centre = await readTextGaps("B_START");
    assert.ok(Math.abs(centre.left - centre.right) < 3, JSON.stringify(centre));
});

test("test_a_sized_block_draws_its_text_at_the_top_or_the_bottom_or_the_middle", async () => {
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_START","alignment":"top","justification":"center","width":300,"height":200}`);
    const top = await readTextGaps("B_START");
    assert.ok(top.top < 40 && top.bottom > 100, JSON.stringify(top));
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_START","alignment":"bottom","justification":"center","width":300,"height":200}`);
    const bottom = await readTextGaps("B_START");
    assert.ok(bottom.bottom < 40 && bottom.top > 100, JSON.stringify(bottom));
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_START","width":300,"height":200}`);
    const middle = await readTextGaps("B_START");
    assert.ok(Math.abs(middle.top - middle.bottom) < 3, JSON.stringify(middle));
});

test("test_a_sized_hexagon_decision_draws_its_text_left_and_top_or_right_and_bottom", async () => {
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"Q_A","alignment":"top","justification":"left","width":500,"height":200}`);
    const leftTop = await readTextGaps("Q_A");
    assert.ok(leftTop.left < leftTop.right - 100, JSON.stringify(leftTop));
    assert.ok(leftTop.top < leftTop.bottom - 40, JSON.stringify(leftTop));
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"Q_A","alignment":"bottom","justification":"right","width":500,"height":200}`);
    const rightBottom = await readTextGaps("Q_A");
    assert.ok(rightBottom.right < rightBottom.left - 100, JSON.stringify(rightBottom));
    assert.ok(rightBottom.bottom < rightBottom.top - 40, JSON.stringify(rightBottom));
});

test("test_an_unsized_block_with_two_lines_shows_the_justification", async () => {
    // Scenario: line 1 is long and line 2 is short; the left edge of line 2 shows where the justification put it.
    const twoLines = BODY.replace('B_START["Start"]', 'B_START["A much longer first line<br/>Hi"]');
    await loadSource(`${twoLines}\n%% ==props==: {"blockId":"B_START","alignment":"center","justification":"left"}`);
    const left = await readLineLeftEdges("B_START");
    assert.ok(Math.abs(left.last - left.first) < 2, JSON.stringify(left));
    await loadSource(`${twoLines}\n%% ==props==: {"blockId":"B_START","alignment":"center","justification":"right"}`);
    const right = await readLineLeftEdges("B_START");
    assert.ok(right.last - right.first > 50, JSON.stringify(right));
    await loadSource(twoLines);
    const centre = await readLineLeftEdges("B_START");
    assert.ok(centre.last - centre.first > 20 && centre.last - centre.first < right.last - right.first, JSON.stringify([centre, right]));
});

test("test_removing_a_node_removes_its_align_line", async () => {
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_END","alignment":"top","justification":"left"}\n%% ==props==: {"blockId":"B_START","alignment":"bottom","justification":"right"}`);
    await clickNodeWithMouse("B_END");
    await waitMilliseconds(300);
    await executeExpression("window.removeBlock(); window.editorActionPromise");
    await waitMilliseconds(500);
    assert.deepEqual(await readAlignLines(), ['%% ==props==: {"blockId":"B_START","alignment":"bottom","justification":"right"}']);
});

test("test_renaming_a_node_renames_its_align_line", async () => {
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_END","alignment":"top","justification":"left"}`);
    await clickNodeWithMouse("B_END");
    await waitMilliseconds(300);
    await executeExpression("(() => { const input = document.getElementById('nodeNameInput'); input.focus(); input.select(); })()");
    for (const character of "FINISH")
        await send("Input.dispatchKeyEvent", { type: "char", text: character, key: character });
    await pressKey(KeyName.Tab);
    await executeExpression("window.editorActionPromise");
    await waitMilliseconds(500);
    assert.deepEqual(await readAlignLines(), ['%% ==props==: {"blockId":"B_FINISH","alignment":"top","justification":"left"}']);
});
