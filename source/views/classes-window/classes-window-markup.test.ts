import { test } from "node:test";
import assert from "node:assert/strict";
import { classesWindowStyle, insertClassesWindow } from "./classes-window-markup.ts";

const CLASSES_WINDOW_IDS = "classesDialog classesList classesError classesNewBtn classesCloseBtn".split(" ");

test("test_insertClassesWindow_adds_its_style_and_its_elements", () => {
    // Scenario: insertClassesWindow puts its own style and its own markup on the page.
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
    insertClassesWindow(parent);
    globalThis.document = previousDocument;
    // Step: one style element holds the style text.
    assert.deepEqual(appendedElements, [{ tagName: "style", textContent: classesWindowStyle }]);
    // Step: one block of markup goes at the end of the parent.
    assert.equal(insertions.length, 1);
    assert.equal(insertions[0]!.position, "beforeend");
    // Step: the markup holds each id of this view.
    for (const id of CLASSES_WINDOW_IDS)
        assert.ok(insertions[0]!.markup.includes(`id="${id}"`), id);
});
