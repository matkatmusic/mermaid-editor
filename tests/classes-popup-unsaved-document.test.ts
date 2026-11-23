import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitForRender } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const TWO_CLASSES_SOURCE = 'flowchart TD\n  B_NEW[New idea]\n  classDef alpha fill:#ffffff,stroke:#000000\n  classDef beta fill:#ff0000,stroke:#000000';

// A new document has no file, so every class action saves with a rejection after it wrote the source.
async function openClassesPopupInUnsavedDocument() {
    await resetEditorFixture();
    await executeExpression("window.confirm = () => true");
    await executeExpression("document.getElementById('newBtn').click()");
    await waitForRender();
    await setEditorSource(TWO_CLASSES_SOURCE);
    await waitForRender();
    await executeExpression("document.getElementById('classesMenuBtn').click()");
}

async function waitForClassAction() {
    await executeExpression("window.editorActionPromise.catch(() => {})");
    await waitForRender();
}

async function listPopupClassNames(): Promise<string[]> {
    return JSON.parse(await executeExpression("JSON.stringify([...document.querySelectorAll('#classesList .classes-row')].map(row => row.dataset.className))"));
}

test("test_classes_popup_shows_a_renamed_class_in_a_new_document_that_has_no_file_to_save_into", async () => {
    // Step: new unsaved document with classes alpha and beta; open File > Classes.
    await openClassesPopupInUnsavedDocument();
    assert.deepEqual(await listPopupClassNames(), ["alpha", "beta"]);
    // Step: rename alpha to gamma in the popup's name box.
    await executeExpression(`(() => {
        const input = document.querySelector('#classesList .classes-row[data-class-name="alpha"] .classes-name');
        input.value = 'gamma';
        input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitForClassAction();
    const names = await listPopupClassNames();
    await executeExpression("document.getElementById('classesCloseBtn').click()");
    // Step: the popup lists the new name right away, even though saving is not possible.
    assert.deepEqual(names, ["gamma", "beta"]);
});

test("test_classes_popup_drops_a_deleted_class_in_a_new_document_that_has_no_file_to_save_into", async () => {
    // Step: new unsaved document with classes alpha and beta; open File > Classes.
    await openClassesPopupInUnsavedDocument();
    assert.deepEqual(await listPopupClassNames(), ["alpha", "beta"]);
    // Step: press Delete on alpha.
    await executeExpression("document.querySelector('#classesList .classes-row[data-class-name=\"alpha\"] .classes-delete').click()");
    await waitForClassAction();
    const names = await listPopupClassNames();
    await executeExpression("document.getElementById('classesCloseBtn').click()");
    // Step: the popup no longer lists alpha, even though saving is not possible.
    assert.deepEqual(names, ["beta"]);
});

test("test_classes_popup_rebuilds_its_rows_after_a_recolor_in_a_new_document_that_has_no_file_to_save_into", async () => {
    // Step: new unsaved document with classes alpha and beta; open File > Classes.
    await openClassesPopupInUnsavedDocument();
    // Step: remember the alpha row, then change its fill color in the popup.
    await executeExpression(`(() => {
        const row = document.querySelector('#classesList .classes-row[data-class-name="alpha"]');
        window.rowBeforeRecolor = row;
        const fill = row.querySelector('.classes-fill');
        fill.value = '#123456';
        fill.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitForClassAction();
    const result = JSON.parse(await executeExpression(`JSON.stringify({
        oldRowStillShown: window.rowBeforeRecolor.isConnected,
        sourceHasNewFill: codeBox.value.includes('classDef alpha fill:#123456'),
        shownFill: document.querySelector('#classesList .classes-row[data-class-name="alpha"] .classes-fill').value,
    })`));
    await executeExpression("document.getElementById('classesCloseBtn').click()");
    // Step: the source holds the new fill, and the popup rebuilt its rows from it.
    assert.equal(result.sourceHasNewFill, true, JSON.stringify(result));
    assert.equal(result.oldRowStillShown, false, JSON.stringify(result));
    assert.equal(result.shownFill, "#123456", JSON.stringify(result));
});
