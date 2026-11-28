import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../browser-harness.ts";
import { executeExpression, waitMilliseconds } from "../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../editor-helpers.ts";
import { clickNodeWithMouse } from "../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const SOURCE = 'flowchart TD\n  B_A["Use `bytes` and `count` here"]\n  B_B["It`s a lone backtick"]\n  B_A --> B_B';

async function startBacktickTest() {
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    // await waitMilliseconds(500);
}

test("test_main_diagram_shows_text_in_backticks_as_a_code_span_without_the_backticks", async () => {
    await startBacktickTest();
    // const measured = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const measured: { labelTop: number; labelBottom: number; nodeTop: number; nodeBottom: number; codeTops: number[]; codeTexts: string[]; nodeText: string; fontFamily: string; backgroundColor: string; paddingLeft: number; codeRights: number[]; nodeRight: number; codeLefts: number[]; nodeLeft: number } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const node = document.querySelector('#diagram [id*="flowchart-B_A-"]');
        const codes = [...node.querySelectorAll('code')];
        const style = getComputedStyle(codes[0]);
        const nodeRect = node.querySelector('rect').getBoundingClientRect();
        const labelRect = node.querySelector('.nodeLabel').getBoundingClientRect();
        return { labelTop: labelRect.top, labelBottom: labelRect.bottom, nodeTop: nodeRect.top, nodeBottom: nodeRect.bottom, codeTops: codes.map((code) => code.getBoundingClientRect().top), codeTexts: codes.map((code) => code.textContent), nodeText: node.textContent.trim(), fontFamily: style.fontFamily, backgroundColor: style.backgroundColor, paddingLeft: parseFloat(style.paddingLeft), codeRights: codes.map((code) => code.getBoundingClientRect().right), nodeRight: nodeRect.right, codeLefts: codes.map((code) => code.getBoundingClientRect().left), nodeLeft: nodeRect.left };
    })())`));
    console.log(`MEASURED main diagram code span: ${JSON.stringify(measured)}`);
    assert.deepEqual(measured.codeTexts, ["bytes", "count"]);
    assert.equal(measured.nodeText, "Use bytes and count here");
    assert.ok(measured.fontFamily.includes("monospace"), measured.fontFamily);
    assert.notEqual(measured.backgroundColor, "rgba(0, 0, 0, 0)");
    assert.ok(measured.paddingLeft > 0);
    assert.ok(measured.labelTop >= measured.nodeTop && measured.labelBottom <= measured.nodeBottom, `label ${measured.labelTop}-${measured.labelBottom}px, node ${measured.nodeTop}-${measured.nodeBottom}px`);
    for (const right of measured.codeRights)
        assert.ok(right <= measured.nodeRight, `code right ${right}px, node right ${measured.nodeRight}px`);
    for (const left of measured.codeLefts)
        assert.ok(left >= measured.nodeLeft, `code left ${left}px, node left ${measured.nodeLeft}px`);
});

test("test_a_single_backtick_without_a_partner_stays_as_it_is", async () => {
    await startBacktickTest();
    // const measured = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const measured: { codeCount: number; nodeText: string } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const node = document.querySelector('#diagram [id*="flowchart-B_B-"]');
        return { codeCount: node.querySelectorAll('code').length, nodeText: node.textContent.trim() };
    })())`));
    assert.equal(measured.codeCount, 0);
    assert.equal(measured.nodeText, "It`s a lone backtick");
});

test("test_the_file_and_the_node_text_box_keep_the_raw_backticks", async () => {
    await startBacktickTest();
    // assert.ok((await executeExpression("codeBox.value")).includes('B_A["Use `bytes` and `count` here"]'));
    assert.ok((await executeExpression<string>("codeBox.value")).includes('B_A["Use `bytes` and `count` here"]'));
    await clickNodeWithMouse("B_A");
    // await waitMilliseconds(300);
    assert.equal(await executeExpression("document.getElementById('nodeTextInput').value"), "Use `bytes` and `count` here");
});

test("test_phone_view_shows_text_in_backticks_as_a_code_span_without_the_backticks", async () => {
    await startBacktickTest();
    await clickNodeWithMouse("B_A");
    // await waitMilliseconds(500);
    // const measured = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const measured: { codeTexts: string[]; blockText: string; fontFamily: string; backgroundColor: string } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const block = document.querySelector('#phoneDiagram [data-node-id="B_A"]');
        const codes = [...block.querySelectorAll('code')];
        const style = getComputedStyle(codes[0]);
        return { codeTexts: codes.map((code) => code.textContent), blockText: block.textContent, fontFamily: style.fontFamily, backgroundColor: style.backgroundColor };
    })())`));
    assert.deepEqual(measured.codeTexts, ["bytes", "count"]);
    assert.equal(measured.blockText, "Use bytes and count here");
    assert.ok(measured.fontFamily.includes("monospace"), measured.fontFamily);
    assert.notEqual(measured.backgroundColor, "rgba(0, 0, 0, 0)");
});
