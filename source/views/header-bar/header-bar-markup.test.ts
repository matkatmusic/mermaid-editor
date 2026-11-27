import { test } from "node:test";
import assert from "node:assert/strict";
import { headerBarStyle, insertHeaderBar } from "./header-bar-markup.ts";

const HEADER_BAR_IDS = "header fileMenu fileMenuItems newBtn saveBtn openFileBtn resetBtn classesMenuBtn diagramsMenu diagramSelect openFileInput searchControls searchBox searchInput searchClearBtn searchPreviousBtn searchNextBtn searchCounter darkModeToggle editorUndoBtn editorRedoBtn previousDecisionBtn nextDecisionBtn decisionCounter mainZoomControls zoomInBtn zoomOutBtn zoomResetBtn zoomLevel functionsOnlyToggle exportAllPathsBtn onePathViewBtn pathViewControls previousViewPathBtn viewPathLabel nextViewPathBtn copyPathCommandBtn fullDiagramBtn downstreamViewBtn downstreamViewControls backDownstreamViewBtn resetDownstreamViewBtn copyDownstreamCommandBtn currentFileName status".split(" ");

test("test_insertHeaderBar_adds_its_style_and_its_elements", () => {
    // Scenario: insertHeaderBar puts its own style and its own markup on the page.
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
    insertHeaderBar(parent);
    globalThis.document = previousDocument;
    // Step: one style element holds the style text.
    assert.deepEqual(appendedElements, [{ tagName: "style", textContent: headerBarStyle }]);
    // Step: one block of markup goes at the end of the parent.
    assert.equal(insertions.length, 1);
    assert.equal(insertions[0]!.position, "beforeend");
    // Step: the markup holds each id of this view.
    for (const id of HEADER_BAR_IDS)
        assert.ok(insertions[0]!.markup.includes(`id="${id}"`), id);
});
