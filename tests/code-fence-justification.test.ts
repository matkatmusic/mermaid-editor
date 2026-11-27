import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitForRender, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

// In the .mmd file a backtick is #96; and a line break is <br/>; the three-backtick lines are the fences.
const FENCE = "#96;#96;#96;";
const CODE_LINE = "const aCodeLineThatIsMuchLongerThanTheIntroduction = 1;";
const FENCE_LABEL = ["Intro", FENCE, CODE_LINE, FENCE].join("<br/>");
const SIZE_ONLY_LINE = '%% ==props==: {"blockId":"B_ONE","width":600,"height":200}';
const CENTER_LINE = '%% ==props==: {"blockId":"B_ONE","justification":"center"}';

async function loadFenceBlock(extraLines: string[] = []) {
    await resetEditorFixture();
    await setEditorSource(["flowchart TD", `  B_ONE["${FENCE_LABEL}"]`, '  B_TWO["Two"]', "  B_ONE --> B_TWO", ...extraLines].join("\n"));
    await waitMilliseconds(600);
}

// How far in px the "Intro" text starts to the right of the left edge of the code block.
async function measureIntroOffsetInMainView(): Promise<number> {
    return Number(await executeExpression(`(() => {
        const node = document.querySelector('#diagram g.node[id*="flowchart-B_ONE-"]');
        const walker = document.createTreeWalker(node.querySelector('.nodeLabel'), NodeFilter.SHOW_TEXT);
        const introText = walker.nextNode();
        const range = document.createRange();
        range.selectNodeContents(introText);
        return range.getBoundingClientRect().left - node.querySelector('code').getBoundingClientRect().left;
    })()`));
}

async function readPhoneTextAlign(): Promise<string> {
    await clickNodeWithMouse("B_ONE");
    await waitMilliseconds(500);
    return executeExpression(`getComputedStyle(document.querySelector('#phoneDiagram [data-node-id="B_ONE"]')).textAlign`);
}

test("test_main_view_shows_a_code_fence_block_without_a_props_line_left_justified", async () => {
    await loadFenceBlock();
    const offset = await measureIntroOffsetInMainView();
    assert.ok(Math.abs(offset) < 1.5, `intro offset ${offset}`);
});

test("test_main_view_shows_a_code_fence_block_with_only_a_size_left_justified", async () => {
    await loadFenceBlock([SIZE_ONLY_LINE]);
    const offset = await measureIntroOffsetInMainView();
    assert.ok(Math.abs(offset) < 1.5, `intro offset ${offset}`);
});

test("test_main_view_keeps_the_explicit_centre_justification_of_a_code_fence_block", async () => {
    await loadFenceBlock([CENTER_LINE]);
    const offset = await measureIntroOffsetInMainView();
    assert.ok(offset > 20, `intro offset ${offset}`);
});

test("test_phone_view_shows_a_code_fence_block_without_a_props_line_left_justified", async () => {
    await loadFenceBlock();
    assert.equal(await readPhoneTextAlign(), "left");
});

test("test_phone_view_shows_a_code_fence_block_with_only_a_size_left_justified", async () => {
    await loadFenceBlock([SIZE_ONLY_LINE]);
    assert.equal(await readPhoneTextAlign(), "left");
});

test("test_phone_view_keeps_the_explicit_centre_justification_of_a_code_fence_block", async () => {
    await loadFenceBlock([CENTER_LINE]);
    assert.equal(await readPhoneTextAlign(), "center");
});

async function selectBlock() {
    await clickNodeWithMouse("B_ONE");
    await waitMilliseconds(500);
}

async function clickAlignButtonWithMouse(attributeName: "justification" | "alignment", value: string) {
    const center = JSON.parse(await executeExpression(`JSON.stringify((() => {
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

async function readPropsLines(): Promise<string[]> {
    return (await executeExpression("codeBox.value")).split("\n").filter((line: string) => line.includes("==props=="));
}

test("test_a_click_on_align_bottom_writes_no_justification_for_a_code_fence_block", async () => {
    await loadFenceBlock();
    await selectBlock();
    await clickAlignButtonWithMouse("alignment", "bottom");
    assert.deepEqual(await readPropsLines(), ['  %% ==props==: {"blockId":"B_ONE","alignment":"bottom"}']);
});

test("test_the_inspector_shows_left_pressed_for_a_code_fence_block_without_a_justification", async () => {
    await loadFenceBlock();
    await selectBlock();
    const pressed = JSON.parse(await executeExpression(`JSON.stringify([...document.querySelectorAll('#nodeAlignRow button[aria-pressed="true"]')].map((button) => button.dataset.justification ?? button.dataset.alignment))`));
    assert.deepEqual(pressed.sort(), ["center", "left"]);
});

test("test_a_click_on_justify_centre_writes_the_centre_justification_of_a_code_fence_block", async () => {
    await loadFenceBlock();
    await selectBlock();
    await clickAlignButtonWithMouse("justification", "center");
    assert.deepEqual(await readPropsLines(), ['  %% ==props==: {"blockId":"B_ONE","justification":"center"}']);
});

test("test_the_centre_justification_of_a_code_fence_block_stays_when_the_alignment_goes_back_to_middle", async () => {
    await loadFenceBlock(['%% ==props==: {"blockId":"B_ONE","alignment":"bottom","justification":"center"}']);
    await selectBlock();
    await clickAlignButtonWithMouse("alignment", "center");
    assert.deepEqual((await readPropsLines()).map((line) => line.trim()), ['%% ==props==: {"blockId":"B_ONE","justification":"center"}']);
});

test("test_a_click_on_justify_left_takes_the_justification_away_from_a_code_fence_block", async () => {
    await loadFenceBlock([CENTER_LINE]);
    await selectBlock();
    await clickAlignButtonWithMouse("justification", "left");
    assert.deepEqual(await readPropsLines(), []);
});

test("test_a_click_on_align_bottom_writes_the_centre_justification_for_a_block_without_a_fence", async () => {
    await loadFenceBlock();
    await clickNodeWithMouse("B_TWO");
    await waitMilliseconds(500);
    await clickAlignButtonWithMouse("alignment", "bottom");
    assert.deepEqual(await readPropsLines(), ['  %% ==props==: {"blockId":"B_TWO","alignment":"bottom","justification":"center"}']);
});
