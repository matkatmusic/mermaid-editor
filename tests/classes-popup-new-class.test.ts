import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitForRender } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { fillClassEditor } from "./class-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

function buildSourceWithClasses(classCount: number) {
    const classLines: string[] = [];
    for (let i = 1; i <= classCount; i++)
        classLines.push(`  classDef existing${i} fill:#ffffff,stroke:#000000`);
    return `flowchart TD\n  B_ONE["One"]\n  B_TWO["Two"]\n  B_ONE --> B_TWO\n${classLines.join("\n")}`;
}

type PopupMeasurement = {
    isOpen: boolean;
    rowCount: number;
    hasNewRow: boolean;
    dialogTop: number;
    dialogBottom: number;
    dialogClientHeight: number;
    dialogScrollHeight: number;
    newRowTop: number | null;
    newRowBottom: number | null;
    isNewRowInsideDialog: boolean;
    windowHeight: number;
};

const MEASURE_POPUP = `JSON.stringify((() => {
    const dialog = document.getElementById('classesDialog');
    const dialogRect = dialog.getBoundingClientRect();
    const rows = [...document.querySelectorAll('#classesList .classes-row')];
    const newRow = rows.find(row => row.dataset.className === 'brandnew');
    const newRowRect = newRow ? newRow.getBoundingClientRect() : null;
    return {
        isOpen: dialog.open,
        rowCount: rows.length,
        hasNewRow: !!newRow,
        dialogTop: Math.round(dialogRect.top),
        dialogBottom: Math.round(dialogRect.bottom),
        dialogClientHeight: dialog.clientHeight,
        dialogScrollHeight: dialog.scrollHeight,
        newRowTop: newRowRect && Math.round(newRowRect.top),
        newRowBottom: newRowRect && Math.round(newRowRect.bottom),
        isNewRowInsideDialog: newRowRect ? newRowRect.top >= dialogRect.top && newRowRect.bottom <= dialogRect.bottom : false,
        windowHeight: window.innerHeight,
    };
})())`;

async function openClassesPopup() {
    await executeExpression("document.getElementById('classesMenuBtn').click()");
}

async function createClassFromPopup() {
    await executeExpression("document.getElementById('classesNewBtn').click()");
    await fillClassEditor("brandnew", "#123456", "#000000");
    await executeExpression("document.getElementById('classEditorCreateBtn').click()");
    await executeExpression("window.editorActionPromise");
    await waitForRender();
}

async function closeClassesPopup() {
    await executeExpression("document.getElementById('classesCloseBtn').click()");
}

async function measureAfterCreatingFromPopup(startingClassCount: number) {
    await resetEditorFixture();
    await setEditorSource(buildSourceWithClasses(startingClassCount));
    await waitForRender();
    await openClassesPopup();
    await createClassFromPopup();
    // return JSON.parse(await executeExpression(MEASURE_POPUP));
    return JSON.parse(await executeExpression<string>(MEASURE_POPUP)) as PopupMeasurement;
}

test("test_classes_popup_shows_the_new_class_when_it_started_with_4_classes", async () => {
    // Step: 4 classes, open File > Classes, create a class with the popup's New... button.
    const measured = await measureAfterCreatingFromPopup(4);
    await closeClassesPopup();
    // Step: the new row is in the popup and inside its visible area.
    assert.equal(measured.rowCount, 5, JSON.stringify(measured));
    assert.ok(measured.isNewRowInsideDialog, JSON.stringify(measured));
});

test("test_classes_popup_shows_the_new_class_when_it_started_with_5_classes", async () => {
    // Step: 5 classes, open File > Classes, create a class with the popup's New... button.
    const measured = await measureAfterCreatingFromPopup(5);
    // Step: the new row is in the popup and inside its visible area, with no close and reopen.
    assert.equal(measured.rowCount, 6, JSON.stringify(measured));
    assert.ok(measured.hasNewRow, JSON.stringify(measured));
    assert.ok(measured.isNewRowInsideDialog, JSON.stringify(measured));
    // Step: after close and reopen the new row is still in the popup.
    await closeClassesPopup();
    await openClassesPopup();
    // const reopened = JSON.parse(await executeExpression(MEASURE_POPUP));
    const reopened = JSON.parse(await executeExpression<string>(MEASURE_POPUP)) as PopupMeasurement;
    await closeClassesPopup();
    assert.ok(reopened.isNewRowInsideDialog, JSON.stringify(reopened));
});

test("test_classes_popup_shows_the_new_class_in_a_new_document_that_has_no_file_to_save_into", async () => {
    // Step: start a new document with the New button; it has no file to auto-save into.
    await resetEditorFixture();
    await executeExpression("window.confirm = () => true");
    await executeExpression("document.getElementById('newBtn').click()");
    await waitForRender();
    // Step: open File > Classes and count the rows.
    await openClassesPopup();
    // const rowCountBefore = await executeExpression("document.querySelectorAll('#classesList .classes-row').length");
    const rowCountBefore = await executeExpression<number>("document.querySelectorAll('#classesList .classes-row').length");
    // Step: create a class with the popup's New... button, with the popup open the whole time.
    await createClassFromPopup();
    // const measured = JSON.parse(await executeExpression(MEASURE_POPUP));
    const measured = JSON.parse(await executeExpression<string>(MEASURE_POPUP)) as PopupMeasurement;
    await closeClassesPopup();
    // Step: the new row is in the popup right away, even though saving the file is not possible.
    assert.equal(measured.rowCount, rowCountBefore + 1, JSON.stringify(measured));
    assert.ok(measured.hasNewRow, JSON.stringify(measured));
    assert.ok(measured.isNewRowInsideDialog, JSON.stringify(measured));
});

test("test_classes_popup_shows_the_new_class_when_it_started_with_9_classes", async () => {
    const measured = await measureAfterCreatingFromPopup(9);
    await closeClassesPopup();
    assert.equal(measured.rowCount, 10, JSON.stringify(measured));
    assert.ok(measured.isNewRowInsideDialog, JSON.stringify(measured));
});
