import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectorNoticeStyle, insertInspectorNotice } from "./inspector-notice-markup.ts";

const INSPECTOR_NOTICE_IDS = "inspectorNotice".split(" ");

test("test_insertInspectorNotice_adds_its_style_and_its_elements", () => {
    // Scenario: insertInspectorNotice puts its own style and its own markup on the page.
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
    insertInspectorNotice(parent);
    globalThis.document = previousDocument;
    // Step: one style element holds the style text.
    assert.deepEqual(appendedElements, [{ tagName: "style", textContent: inspectorNoticeStyle }]);
    // Step: one block of markup goes at the end of the parent.
    assert.equal(insertions.length, 1);
    assert.equal(insertions[0]!.position, "beforeend");
    // Step: the markup holds each id of this view.
    for (const id of INSPECTOR_NOTICE_IDS)
        assert.ok(insertions[0]!.markup.includes(`id="${id}"`), id);
});
