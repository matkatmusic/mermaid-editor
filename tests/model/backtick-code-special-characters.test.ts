import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../browser-harness.ts";
import { executeExpression, waitMilliseconds } from "../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../editor-helpers.ts";
import { clickNodeWithMouse } from "../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const CODE_TEXTS: Record<string, string> = {
    B_TEMPLATE: "vector<int>",
    B_LESS_NO_SPACE: "a<b",
    B_LESS_SPACE: "i < n",
    B_AND: "a && b",
    B_GREATER: "x > 0",
};
const SOURCE = [
    "flowchart TD",
    '  B_START["Start"]',
    ...Object.entries(CODE_TEXTS).map(([id, codeText]) => `  ${id}["Use \`${codeText}\` here"]`),
    `  ${["B_START", ...Object.keys(CODE_TEXTS)].join(" --> ")}`,
].join("\n");

async function loadFixture() {
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    await waitMilliseconds(500);
}

test("test_main_diagram_code_spans_show_angle_brackets_and_ampersands_exactly", async () => {
    await loadFixture();
    // const codeTextsById = JSON.parse(await executeExpression(`JSON.stringify(Object.fromEntries(${JSON.stringify(Object.keys(CODE_TEXTS))}.map((id) => {
    const codeTextsById: Record<string, string | string[]> = JSON.parse(await executeExpression(`JSON.stringify(Object.fromEntries(${JSON.stringify(Object.keys(CODE_TEXTS))}.map((id) => {
        const node = document.querySelector('#diagram [id*="flowchart-' + id + '-"]');
        if (!node)
            return [id, 'node missing; node ids: ' + [...document.querySelectorAll('#diagram [id^="flowchart-"]')].map((found) => found.id).join(',') + '; error log: ' + errorLog.textContent.slice(0, 300)];
        return [id, [...node.querySelectorAll('code')].map((code) => code.textContent)];
    })))`));
    for (const [id, codeText] of Object.entries(CODE_TEXTS))
        assert.deepEqual(codeTextsById[id], [codeText], `main diagram node ${id}`);
});

test("test_phone_block_code_spans_show_angle_brackets_and_ampersands_exactly", async () => {
    await loadFixture();
    for (const [id, codeText] of Object.entries(CODE_TEXTS)) {
        await clickNodeWithMouse(id);
        await waitMilliseconds(300);
        // const codeTexts = JSON.parse(await executeExpression(`JSON.stringify([...document.querySelectorAll('#phoneDiagram [data-node-id="${id}"] code')].map((code) => code.textContent))`));
        const codeTexts: string[] = JSON.parse(await executeExpression(`JSON.stringify([...document.querySelectorAll('#phoneDiagram [data-node-id="${id}"] code')].map((code) => code.textContent))`));
        assert.deepEqual(codeTexts, [codeText], `phone block ${id}`);
    }
});
