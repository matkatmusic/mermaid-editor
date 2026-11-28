import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../browser-harness.ts";
// import { executeExpression, waitForRender, waitMilliseconds } from "../cdp.ts";
import { executeAndWaitForRender, executeExpression, waitForRender } from "../cdp.ts";
import { openEditorDrawer, resetEditorFixture } from "../editor-helpers.ts";
import { clickNodeWithMouse } from "../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const DEFAULT_CLASS_LINES = [
    "classDef information fill:#ffffff,stroke:#000000",
    "classDef Decision fill:#ffff00,stroke:#000000",
    "classDef Yes-path fill:#00ff00,stroke:#000000",
    "classDef No-path fill:#ff0000,stroke:#000000",
    "classDef Checkpoint fill:#ff8000,stroke:#000000",
    "classDef Action fill:#fc00ff,stroke:#000000",
    "classDef Question fill:#79d4fb,stroke:#000000",
    "classDef Answer fill:#5df9b5,stroke:#000000",
];

async function clickNewButton() {
    await resetEditorFixture();
    // await executeExpression("document.getElementById('newBtn').click()");
    // await waitMilliseconds(1000);
    await executeAndWaitForRender(() => executeExpression("document.getElementById('newBtn').click()"));
}

test("test_new_document_source_holds_the_default_class_lines_in_order", async () => {
    await clickNewButton();
    const source: string = await executeExpression("codeBox.value");
    const classDefLines = source.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("classDef"));
    assert.deepEqual(classDefLines, DEFAULT_CLASS_LINES);
});

test("test_new_document_with_default_classes_renders_without_an_error_and_shows_its_node", async () => {
    await clickNewButton();
    assert.equal(await executeExpression("document.getElementById('error').textContent"), "");
    assert.equal(await executeExpression("errorLog.textContent"), "");
    const hitNodeId = await executeExpression(`(() => {
        const node = document.querySelector('#diagram g.node');
        const rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const hitNode = hit && hit.closest('g.node');
        return hitNode ? hitNode.id : 'hit: ' + (hit ? hit.tagName + '#' + hit.id : 'nothing');
    })()`);
    assert.equal(hitNodeId, await executeExpression("document.querySelector('#diagram g.node').id"));
});

test("test_class_picker_of_a_new_document_lists_the_default_class_names_in_order", async () => {
    await clickNewButton();
    await clickNodeWithMouse("B_NEW");
    // await waitMilliseconds(300);
    const names: string[] = JSON.parse(await executeExpression("JSON.stringify([...document.querySelectorAll('#classPickerList [data-class-name]')].map((row) => row.dataset.className))"));
    assert.deepEqual(names, ["information", "Decision", "Yes-path", "No-path", "Checkpoint", "Action", "Question", "Answer"]);
});

for (const [className, expectedFill] of [["Yes-path", "rgb(0, 255, 0)"], ["No-path", "rgb(255, 0, 0)"]]) {
    test(`test_assigning_the_class_${className}_colors_the_new_documents_node`, async () => {
        await clickNewButton();
        await clickNodeWithMouse("B_NEW");
        // await waitMilliseconds(300);
        await executeExpression("document.getElementById('classPickerBtn').click()");
        await executeExpression(`document.querySelector('#classPickerList [data-class-name="${className}"]').click()`);
        await executeExpression("window.editorActionPromise");
        await waitForRender();
        assert.equal(await executeExpression("document.getElementById('error').textContent"), "");
        const source: string = await executeExpression("codeBox.value");
        assert.ok(source.includes(`class B_NEW ${className}`), source);
        assert.equal(await executeExpression(`getComputedStyle(document.querySelector('#diagram [id*="flowchart-B_NEW-"] rect')).fill`), expectedFill);
        assert.equal(await executeExpression(`document.querySelector('#phoneDiagram [data-node-id="B_NEW"]').style.background`), expectedFill);
    });
}
