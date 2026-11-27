import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectorStyle, insertInspector, insertInspectorRetiredTemplate } from "./inspector-markup.ts";

const INSPECTOR_IDS = "nodeInspector nodeInspectorResizeHandle nodeInspectorTitle nodeIdentityBox nodeKindRow nodeKindStatic nodeKindQuestion decisionShapeRow decisionShapeSwitch nodeKindChoice nodeParentLabel nodeAlignRow nodeNameInput nodeNameCheck nodeTextNotesRow nodeTextColumn nodeTextInput nodeTextHint nodeNotesRow nodeNotesInput nodeNotesHint inspectorBottomRow nodeClassRow classPicker classPickerBtn classPickerSwatch classPickerLabel classPickerList nodeInspectorControls nodeInspectorDismissBtn destinationRow destinationInput destinationSelect destinationList nodeInspectorButtonsRow walkBackBtn nodeInspectorActions nodeInspectorRemovalPreview nextRemovalPathBtn confirmRemoveQuestionBtn cancelRemoveQuestionBtn".split(" ");

// Stand-ins record what an insert function adds to document.head and to the parent.
function recordInsert(insert: (parent: Element) => void) {
    const appendedElements: unknown[] = [];
    const insertions: { position: string; markup: string }[] = [];
    const parent = { insertAdjacentHTML: (position: string, markup: string) => insertions.push({ position, markup }) } as unknown as Element;
    const previousDocument = globalThis.document;
    globalThis.document = {
        createElement: (tagName: string) => ({ tagName, textContent: "" }),
        head: { append: (element: unknown) => appendedElements.push(element) },
    } as unknown as Document;
    insert(parent);
    globalThis.document = previousDocument;
    return { appendedElements, insertions };
}

test("test_insertInspector_adds_its_style_and_its_elements", () => {
    // Scenario: insertInspector puts its own style and its own markup on the page.
    // Step: run the function against the stand-ins.
    const { appendedElements, insertions } = recordInsert(insertInspector);
    // Step: one style element holds the style text.
    assert.deepEqual(appendedElements, [{ tagName: "style", textContent: inspectorStyle }]);
    // Step: one block of markup goes at the end of the parent.
    assert.equal(insertions.length, 1);
    assert.equal(insertions[0]!.position, "beforeend");
    // Step: the markup holds each id of this view.
    for (const id of INSPECTOR_IDS)
        assert.ok(insertions[0]!.markup.includes(`id="${id}"`), id);
});

test("test_insertInspectorRetiredTemplate_adds_a_template_element_and_no_style", () => {
    // Scenario: the retired inspector markup stays on the page inside a template element.
    // Step: run the function against the stand-ins.
    const { appendedElements, insertions } = recordInsert(insertInspectorRetiredTemplate);
    // Step: no style element goes on the page.
    assert.deepEqual(appendedElements, []);
    // Step: one block of markup with a template element goes at the end of the parent.
    assert.equal(insertions.length, 1);
    assert.equal(insertions[0]!.position, "beforeend");
    assert.ok(insertions[0]!.markup.includes("<template>"));
});
