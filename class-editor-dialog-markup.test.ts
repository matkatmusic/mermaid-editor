import { test } from "node:test";
import assert from "node:assert/strict";
import { insertClassEditorDialog } from "./class-editor-dialog-markup.ts";

const CLASS_EDITOR_DIALOG_IDS = "classEditorDialog classEditorName classEditorFill classEditorStroke classEditorError classEditorCancelBtn classEditorCreateBtn".split(" ");

test("test_insertClassEditorDialog_adds_its_elements_and_no_style", () => {
    // Scenario: insertClassEditorDialog puts its own markup on the page. The dialog has no style of its own.
    // Step: stand-ins record what the function adds to document.head and to the parent.
    const appendedElements: unknown[] = [];
    const insertions: { position: string; markup: string }[] = [];
    const parent = { insertAdjacentHTML: (position: string, markup: string) => insertions.push({ position, markup }) } as unknown as Element;
    const previousDocument = globalThis.document;
    globalThis.document = {
        createElement: (tagName: string) => ({ tagName, textContent: "" }),
        head: { append: (element: unknown) => appendedElements.push(element) },
    } as unknown as Document;
    // Step: run the function, then put the previous document back.
    insertClassEditorDialog(parent);
    globalThis.document = previousDocument;
    // Step: no style element goes on the page.
    assert.deepEqual(appendedElements, []);
    // Step: one block of markup goes at the end of the parent.
    assert.equal(insertions.length, 1);
    assert.equal(insertions[0]!.position, "beforeend");
    // Step: the markup holds each id of this view.
    for (const id of CLASS_EDITOR_DIALOG_IDS)
        assert.ok(insertions[0]!.markup.includes(`id="${id}"`), id);
});
