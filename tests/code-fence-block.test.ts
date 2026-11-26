import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse } from "./real-input.ts";
registerBrowserHooks(import.meta.url, openEditorDrawer);
// In the .mmd file a backtick is #96; and a line break is <br/>; the three-backtick lines are the fences.
const FENCE = "#96;#96;#96;";
const LONG_INTRO = "An introduction line that is longer than every code line";
const CODE_LABEL = [LONG_INTRO, FENCE, "if (a) {", "  go();", "}", FENCE, "Outro"].join("<br/>");
const TOLERANCE_PX = 1.5;
const CODE_PADDING_PX = 4;
async function loadSource(source: string) {
    await resetEditorFixture();
    await setEditorSource(source);
    await waitMilliseconds(600);
}
function buildRectSource(label: string, extraLines: string[] = []) {
    return ["flowchart TD", `  B_ONE["${label}"]`, '  B_TWO["Two"]', "  B_ONE --> B_TWO", ...extraLines].join("\n");
}
function buildHexagonSource(label: string, extraLines: string[] = []) {
    return ["flowchart TD", `  Q_ONE{{"${label}"}}`, '  B_TWO["Two"]', "  Q_ONE --> B_TWO", ...extraLines].join("\n");
}
type MainMeasure = {
    codeCount: number;
    code: { display: string; textAlign: string; whiteSpace: string; fontFamily: string; text: string; left: number; right: number; top: number; bottom: number } | null;
    nodeText: string;
    labelLeft: number;
    lineLefts: number[];
    box: { left: number; right: number; top: number; bottom: number };
    textRects: { left: number; right: number; top: number; bottom: number }[];
};
async function measureMainNode(id: string, shapeTag: string): Promise<MainMeasure> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const node = document.querySelector('#diagram g.node[id*="flowchart-${id}-"]');
        const box = node.querySelector('${shapeTag}').getBoundingClientRect();
        const codes = [...node.querySelectorAll('code')];
        const first = codes[0];
        let code = null;
        const lineLefts = [];
        if (first) {
            const style = getComputedStyle(first);
            const rect = first.getBoundingClientRect();
            code = { display: style.display, textAlign: style.textAlign, whiteSpace: style.whiteSpace, fontFamily: style.fontFamily, text: first.innerText, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
            const walker = document.createTreeWalker(first, NodeFilter.SHOW_TEXT);
            for (let current = walker.nextNode(); current; current = walker.nextNode()) {
                const range = document.createRange();
                range.selectNodeContents(current);
                lineLefts.push(range.getBoundingClientRect().left);
            }
        }
        const textRects = [];
        const walker = document.createTreeWalker(node.querySelector('.nodeLabel'), NodeFilter.SHOW_TEXT);
        for (let current = walker.nextNode(); current; current = walker.nextNode()) {
            if (!current.data.trim())
                continue;
            const range = document.createRange();
            range.selectNodeContents(current);
            for (const rect of range.getClientRects())
                textRects.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
        }
        const wrapper = first ? first.parentElement : node.querySelector('.nodeLabel');
        return {
            codeCount: codes.length,
            code,
            nodeText: node.querySelector('.nodeLabel').innerText,
            labelLeft: wrapper.getBoundingClientRect().left,
            lineLefts,
            box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
            textRects,
        };
    })())`));
}
function assertTextInsideBox(measured: MainMeasure) {
    assert.ok(measured.textRects.length > 0, JSON.stringify(measured));
    for (const rect of measured.textRects) {
        assert.ok(rect.left >= measured.box.left - TOLERANCE_PX, `text left ${rect.left}, box left ${measured.box.left}`);
        assert.ok(rect.right <= measured.box.right + TOLERANCE_PX, `text right ${rect.right}, box right ${measured.box.right}`);
        assert.ok(rect.top >= measured.box.top - TOLERANCE_PX, `text top ${rect.top}, box top ${measured.box.top}`);
        assert.ok(rect.bottom <= measured.box.bottom + TOLERANCE_PX, `text bottom ${rect.bottom}, box bottom ${measured.box.bottom}`);
    }
}
test("test_lines_between_two_fences_are_drawn_as_one_monospace_code_block_without_the_fences", async () => {
    await loadSource(buildRectSource(CODE_LABEL));
    const measured = await measureMainNode("B_ONE", "rect");
    console.log(`MEASURED code block: ${JSON.stringify(measured)}`);
    assert.equal(measured.codeCount, 1, JSON.stringify(measured));
    assert.ok(measured.code, JSON.stringify(measured));
    assert.equal(measured.code!.display, "block");
    assert.equal(measured.code!.whiteSpace, "pre");
    assert.ok(measured.code!.fontFamily.includes("monospace"), measured.code!.fontFamily);
    assert.equal(measured.code!.text, "if (a) {\n  go();\n}");
    assert.ok(!measured.nodeText.includes("`"), measured.nodeText);
    assert.ok(measured.nodeText.includes(LONG_INTRO) && measured.nodeText.includes("Outro"), measured.nodeText);
});
test("test_a_code_block_is_left_justified_when_the_block_text_is_centre_justified", async () => {
    await loadSource(buildRectSource(CODE_LABEL));
    const measured = await measureMainNode("B_ONE", "rect");
    assert.equal(measured.code!.textAlign, "left");
    assert.ok(Math.abs(measured.code!.left - measured.labelLeft) < TOLERANCE_PX, JSON.stringify(measured));
    const [firstLineLeft, ...otherLineLefts] = measured.lineLefts;
    assert.ok(Math.abs(firstLineLeft - (measured.code!.left + CODE_PADDING_PX)) < TOLERANCE_PX, JSON.stringify(measured));
    for (const lineLeft of otherLineLefts)
        assert.ok(Math.abs(lineLeft - firstLineLeft) < TOLERANCE_PX, JSON.stringify(measured));
});
test("test_a_code_block_is_left_justified_when_the_block_text_is_right_justified", async () => {
    await loadSource(buildRectSource(CODE_LABEL, ['%% ==props==: {"blockId":"B_ONE","alignment":"center","justification":"right","width":500,"height":200}']));
    const measured = await measureMainNode("B_ONE", "rect");
    // The text box moves to the right with the size line; inside it the code lines stay on the left and the other text follows the right justification.
    assert.equal(measured.code!.textAlign, "left");
    assert.ok(Math.abs(measured.code!.left - measured.labelLeft) < TOLERANCE_PX, JSON.stringify(measured));
    const outroRect = measured.textRects[measured.textRects.length - 1];
    assert.ok(Math.abs(outroRect.right - measured.code!.right) < TOLERANCE_PX, JSON.stringify(measured));
    const [firstLineLeft, ...otherLineLefts] = measured.lineLefts;
    for (const lineLeft of otherLineLefts)
        assert.ok(Math.abs(lineLeft - firstLineLeft) < TOLERANCE_PX, JSON.stringify(measured));
});
test("test_a_code_block_fits_inside_a_rectangle_block_with_and_without_a_size_line", async () => {
    for (const extraLines of [[], ['%% ==props==: {"blockId":"B_ONE","width":160,"height":60}']]) {
        await loadSource(buildRectSource(CODE_LABEL, extraLines));
        assertTextInsideBox(await measureMainNode("B_ONE", "rect"));
    }
});
test("test_a_code_block_fits_inside_a_hexagon_decision_with_and_without_a_size_line", async () => {
    for (const extraLines of [[], ['%% ==props==: {"blockId":"Q_ONE","width":160,"height":60}']]) {
        await loadSource(buildHexagonSource(CODE_LABEL, extraLines));
        assertTextInsideBox(await measureMainNode("Q_ONE", "polygon"));
    }
});
test("test_a_code_line_longer_than_80_characters_is_not_wrapped_and_stays_inside_the_block", async () => {
    const longLine = "const veryLongName = " + "x".repeat(90) + ";";
    await loadSource(buildRectSource([FENCE, longLine, FENCE].join("<br/>")));
    const measured = await measureMainNode("B_ONE", "rect");
    assert.equal(measured.code!.text, longLine);
    assert.equal(new Set(measured.textRects.map((rect) => Math.round(rect.top))).size, 1, JSON.stringify(measured));
    assertTextInsideBox(measured);
});
test("test_a_lone_opening_fence_is_drawn_as_plain_text", async () => {
    await loadSource(buildRectSource(["before", FENCE, "after"].join("<br/>")));
    const measured = await measureMainNode("B_ONE", "rect");
    assert.equal(measured.codeCount, 0, JSON.stringify(measured));
    assert.ok(measured.nodeText.includes("```"), measured.nodeText);
});
test("test_single_backticks_still_draw_an_inline_code_span", async () => {
    await loadSource(buildRectSource("run #96;go();#96; now"));
    const measured = await measureMainNode("B_ONE", "rect");
    assert.equal(measured.codeCount, 1, JSON.stringify(measured));
    assert.equal(measured.code!.display, "inline");
    assert.equal(measured.code!.text, "go();");
});
test("test_the_phone_view_shows_the_same_left_justified_code_block", async () => {
    await loadSource(buildRectSource(CODE_LABEL));
    await clickNodeWithMouse("B_ONE");
    await waitMilliseconds(500);
    const measured = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const block = document.querySelector('#phoneDiagram [data-node-id="B_ONE"]');
        const codes = [...block.querySelectorAll('code')];
        const style = getComputedStyle(codes[0]);
        return { codeCount: codes.length, display: style.display, textAlign: style.textAlign, whiteSpace: style.whiteSpace, text: codes[0].innerText, blockText: block.innerText };
    })())`));
    console.log(`MEASURED phone code block: ${JSON.stringify(measured)}`);
    assert.equal(measured.codeCount, 1, JSON.stringify(measured));
    assert.equal(measured.display, "block");
    assert.equal(measured.textAlign, "left");
    assert.equal(measured.whiteSpace, "pre");
    assert.equal(measured.text, "if (a) {\n  go();\n}");
    assert.ok(!measured.blockText.includes("`"), measured.blockText);
});
