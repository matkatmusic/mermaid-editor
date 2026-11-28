import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../browser-harness.ts";
// import { executeExpression, waitMilliseconds } from "../cdp.ts";
import { executeExpression } from "../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../editor-helpers.ts";
import { clickNodeWithMouse } from "../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

// The label of line 313 of puzzle-solver-rules.mmd; \n is a literal backslash and the letter n.
const LABEL = "Add the git commits that changed `F` to the puzzle, newest first, after node 0 (a delete commit means absent)\\n`puzzle = addCommits(puzzle, repo, commitHash);`";
const SOURCE = ["flowchart TD", '  B_START["Start"]', `  B_PUZZLE_ADD_GIT_COMMITS["${LABEL}"]`, "  B_START --> B_PUZZLE_ADD_GIT_COMMITS"].join("\n");

async function loadFixture() {
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    // await waitMilliseconds(500);
}

// Fraction of a pixel that the browser may round away.
const TOLERANCE_PX = 1;

type MainDiagramMeasurement = {
    box: { left: number; right: number; top: number; bottom: number };
    textRects: { left: number; right: number; top: number; bottom: number }[];
    codeCount: number;
    text: string;
    labelScrollWidth: number;
    labelClientWidth: number;
};

type PhoneBlockMeasurement = {
    box: { left: number; right: number };
    textRects: { left: number; right: number }[];
    scrollWidth: number;
    clientWidth: number;
    codeCount: number;
};

test("test_main_diagram_label_text_sits_inside_the_node_box_with_code_spans", async () => {
    await loadFixture();
    // const measured = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const measured: MainDiagramMeasurement = JSON.parse(await executeExpression<string>(`JSON.stringify((() => {
        const node = document.querySelector('#diagram [id*="flowchart-B_PUZZLE_ADD_GIT_COMMITS-"]');
        const box = node.querySelector('rect').getBoundingClientRect();
        const walker = document.createTreeWalker(node.querySelector('.nodeLabel'), NodeFilter.SHOW_TEXT);
        const textRects = [];
        for (let current = walker.nextNode(); current; current = walker.nextNode()) {
            if (!current.data.trim())
                continue;
            const range = document.createRange();
            range.selectNodeContents(current);
            for (const rect of range.getClientRects())
                textRects.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
        }
        const label = node.querySelector('.nodeLabel');
        return { box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom }, textRects, codeCount: node.querySelectorAll('code').length, text: node.textContent.trim(), labelScrollWidth: label.scrollWidth, labelClientWidth: label.clientWidth };
    })())`));
    // console.log(`MEASURED main diagram fit: ${JSON.stringify({ box: measured.box, rectCount: measured.textRects.length, maxRight: Math.max(...measured.textRects.map((rect: any) => rect.right)), minLeft: Math.min(...measured.textRects.map((rect: any) => rect.left)), maxBottom: Math.max(...measured.textRects.map((rect: any) => rect.bottom)), minTop: Math.min(...measured.textRects.map((rect: any) => rect.top)), labelScrollWidth: measured.labelScrollWidth, labelClientWidth: measured.labelClientWidth })}`);
    console.log(`MEASURED main diagram fit: ${JSON.stringify({ box: measured.box, rectCount: measured.textRects.length, maxRight: Math.max(...measured.textRects.map((rect: { left: number; right: number; top: number; bottom: number }) => rect.right)), minLeft: Math.min(...measured.textRects.map((rect: { left: number; right: number; top: number; bottom: number }) => rect.left)), maxBottom: Math.max(...measured.textRects.map((rect: { left: number; right: number; top: number; bottom: number }) => rect.bottom)), minTop: Math.min(...measured.textRects.map((rect: { left: number; right: number; top: number; bottom: number }) => rect.top)), labelScrollWidth: measured.labelScrollWidth, labelClientWidth: measured.labelClientWidth })}`);
    assert.equal(measured.codeCount, 2);
    assert.ok(!measured.text.includes("`"));
    assert.ok(measured.textRects.length > 2);
    for (const rect of measured.textRects) {
        assert.ok(rect.right <= measured.box.right + TOLERANCE_PX, `text right ${rect.right}px, node right ${measured.box.right}px`);
        assert.ok(rect.left >= measured.box.left - TOLERANCE_PX, `text left ${rect.left}px, node left ${measured.box.left}px`);
        assert.ok(rect.top >= measured.box.top - TOLERANCE_PX, `text top ${rect.top}px, node top ${measured.box.top}px`);
        assert.ok(rect.bottom <= measured.box.bottom + TOLERANCE_PX, `text bottom ${rect.bottom}px, node bottom ${measured.box.bottom}px`);
    }
    assert.ok(measured.labelScrollWidth <= measured.labelClientWidth + TOLERANCE_PX, `label scrollWidth ${measured.labelScrollWidth}px, clientWidth ${measured.labelClientWidth}px`);
});

test("test_phone_block_text_sits_inside_the_block_with_code_spans", async () => {
    await loadFixture();
    await clickNodeWithMouse("B_PUZZLE_ADD_GIT_COMMITS");
    // await waitMilliseconds(500);
    // const measured = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const measured: PhoneBlockMeasurement = JSON.parse(await executeExpression<string>(`JSON.stringify((() => {
        const block = document.querySelector('#phoneDiagram [data-node-id="B_PUZZLE_ADD_GIT_COMMITS"]');
        const box = block.getBoundingClientRect();
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        const textRects = [];
        for (let current = walker.nextNode(); current; current = walker.nextNode()) {
            if (!current.data.trim())
                continue;
            const range = document.createRange();
            range.selectNodeContents(current);
            for (const rect of range.getClientRects())
                textRects.push({ left: rect.left, right: rect.right });
        }
        return { box: { left: box.left, right: box.right }, textRects, scrollWidth: block.scrollWidth, clientWidth: block.clientWidth, codeCount: block.querySelectorAll('code').length };
    })())`));
    // console.log(`MEASURED phone fit: ${JSON.stringify({ box: measured.box, maxRight: Math.max(...measured.textRects.map((rect: any) => rect.right)), minLeft: Math.min(...measured.textRects.map((rect: any) => rect.left)), scrollWidth: measured.scrollWidth, clientWidth: measured.clientWidth })}`);
    console.log(`MEASURED phone fit: ${JSON.stringify({ box: measured.box, maxRight: Math.max(...measured.textRects.map((rect: { left: number; right: number }) => rect.right)), minLeft: Math.min(...measured.textRects.map((rect: { left: number; right: number }) => rect.left)), scrollWidth: measured.scrollWidth, clientWidth: measured.clientWidth })}`);
    assert.equal(measured.codeCount, 2);
    for (const rect of measured.textRects) {
        assert.ok(rect.right <= measured.box.right + TOLERANCE_PX, `text right ${rect.right}px, block right ${measured.box.right}px`);
        assert.ok(rect.left >= measured.box.left - TOLERANCE_PX, `text left ${rect.left}px, block left ${measured.box.left}px`);
    }
    assert.ok(measured.scrollWidth <= measured.clientWidth + TOLERANCE_PX, `scrollWidth ${measured.scrollWidth}px, clientWidth ${measured.clientWidth}px`);
});
