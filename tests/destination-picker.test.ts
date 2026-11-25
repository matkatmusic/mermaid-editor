import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse, KeyName, pressKey } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const SOURCE = [
    "flowchart TD", '  B_START["Start"]', '  Q_ASK{"Ask?"}', '  Q_CHOICE_ASK_YES["Yes"]', '  B_END["End"]',
    '  B_BANANA["Banana split"]', '  B_CHERRY_PIE["Cherry"]',
    "  B_START --> Q_ASK", "  Q_ASK --> Q_CHOICE_ASK_YES --> B_END",
].join("\n");

async function selectChoiceWithDestinationPicker() {
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    await waitMilliseconds(500);
    await clickNodeWithMouse("Q_CHOICE_ASK_YES");
    await waitMilliseconds(300);
}

async function getPickerState(): Promise<{ inputValue: string; listIsOpen: boolean; listTexts: string[]; highlightedText: string | null; selectOptionTexts: string[] }> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const list = document.getElementById('destinationList');
        const items = [...list.querySelectorAll('[role="option"]')];
        const highlighted = items.find((item) => item.getAttribute('aria-selected') === 'true');
        return {
            inputValue: document.getElementById('destinationInput').value, listIsOpen: !list.hidden,
            listTexts: items.map((item) => item.textContent), highlightedText: highlighted ? highlighted.textContent : null,
            selectOptionTexts: [...document.querySelectorAll('#destinationSelect option')].map((option) => option.textContent),
        };
    })())`));
}

async function clickWithMouse(selector: string) {
    const center = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })())`));
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount: 1 });
    await waitMilliseconds(200);
}

async function typeIntoDestinationInput(text: string) {
    await clickWithMouse("#destinationInput");
    await executeExpression("document.getElementById('destinationInput').select()");
    await send("Input.insertText", { text });
    await waitMilliseconds(200);
}

test("test_destination_picker_shows_the_present_destination_when_not_in_use", async () => {
    // Step: select a choice whose destination is B_END.
    await selectChoiceWithDestinationPicker();
    // Step: the input shows the text and the id of B_END, and the list is closed.
    const state = await getPickerState();
    assert.equal(state.inputValue, "End (B_END)");
    assert.equal(state.listIsOpen, false);
});

test("test_destination_picker_list_offers_the_same_nodes_as_the_old_select", async () => {
    // Step: click the input with nothing typed.
    await selectChoiceWithDestinationPicker();
    await clickWithMouse("#destinationInput");
    // Step: the list shows every option of the select, in the same order.
    const state = await getPickerState();
    assert.equal(state.listIsOpen, true);
    assert.deepEqual(state.listTexts, state.selectOptionTexts);
});

test("test_destination_picker_typing_part_of_a_node_text_filters_the_list", async () => {
    // Step: type part of a node text, in another letter case.
    await selectChoiceWithDestinationPicker();
    await typeIntoDestinationInput("BANANA S");
    // Step: only the node with that text is listed.
    assert.deepEqual((await getPickerState()).listTexts, ["Banana split (B_BANANA)"]);
});

test("test_destination_picker_typing_part_of_a_node_id_filters_the_list", async () => {
    // Step: type part of a node id that is not in the node text.
    await selectChoiceWithDestinationPicker();
    await typeIntoDestinationInput("cherry_p");
    // Step: the node with that id is listed.
    assert.deepEqual((await getPickerState()).listTexts, ["Cherry (B_CHERRY_PIE)"]);
});

test("test_destination_picker_click_on_a_result_sets_the_destination_and_undo_restores_it", async () => {
    // Step: type "banana" and click the result with the mouse.
    await selectChoiceWithDestinationPicker();
    await typeIntoDestinationInput("banana");
    await clickWithMouse("#destinationList [role=\"option\"]");
    await executeExpression("window.editorActionPromise");
    // Step: the source links the choice to B_BANANA and no longer to B_END, and the input shows the new destination.
    const sourceAfterPick: string = await executeExpression("codeBox.value");
    assert.ok(sourceAfterPick.includes("Q_CHOICE_ASK_YES --> B_BANANA"), sourceAfterPick);
    assert.ok(!sourceAfterPick.includes("Q_CHOICE_ASK_YES --> B_END"), sourceAfterPick);
    assert.equal((await getPickerState()).inputValue, "Banana split (B_BANANA)");
    // Step: undo puts the old destination back.
    await executeExpression("document.getElementById('editorUndoBtn').click()");
    await executeExpression("window.editorActionPromise");
    await waitMilliseconds(300);
    const sourceAfterUndo: string = await executeExpression("codeBox.value");
    assert.ok(sourceAfterUndo.includes("Q_CHOICE_ASK_YES --> B_END"), sourceAfterUndo);
});

test("test_destination_picker_arrow_down_and_enter_pick_the_highlighted_result", async () => {
    // Step: type "cherry", press Arrow Down to highlight the first result, then press Enter.
    await selectChoiceWithDestinationPicker();
    await typeIntoDestinationInput("cherry");
    await pressKey(KeyName.ArrowDown);
    assert.equal((await getPickerState()).highlightedText, "Cherry (B_CHERRY_PIE)");
    await pressKey(KeyName.Enter);
    await executeExpression("window.editorActionPromise");
    // Step: the source links the choice to B_CHERRY_PIE.
    const source: string = await executeExpression("codeBox.value");
    assert.ok(source.includes("Q_CHOICE_ASK_YES --> B_CHERRY_PIE"), source);
});

test("test_destination_picker_escape_closes_the_list_and_restores_the_shown_destination", async () => {
    // Step: type "banana", then press Escape.
    await selectChoiceWithDestinationPicker();
    await typeIntoDestinationInput("banana");
    await pressKey(KeyName.Escape);
    // Step: the list is closed, the input shows B_END again, and the source did not change.
    const state = await getPickerState();
    assert.equal(state.listIsOpen, false);
    assert.equal(state.inputValue, "End (B_END)");
    assert.ok((await executeExpression("codeBox.value") as string).includes("Q_CHOICE_ASK_YES --> B_END"));
});

test("test_destination_picker_click_outside_closes_the_list_and_restores_the_shown_destination", async () => {
    // Step: type "banana", then click the Node text box.
    await selectChoiceWithDestinationPicker();
    await typeIntoDestinationInput("banana");
    await clickWithMouse("#nodeTextInput");
    // Step: the list is closed and the input shows B_END again.
    const state = await getPickerState();
    assert.equal(state.listIsOpen, false);
    assert.equal(state.inputValue, "End (B_END)");
});

test("test_destination_picker_rows_do_not_overlap_when_the_list_is_long", async () => {
    // Step: load a diagram with 30 blocks and select the choice.
    const manyBlocks = Array.from({ length: 30 }, (_, index) => `  B_EXTRA_${index}["Extra ${index}"]`);
    const longSource = SOURCE.replace('  B_CHERRY_PIE["Cherry"]', ['  B_CHERRY_PIE["Cherry"]', ...manyBlocks].join("\n"));
    await resetEditorFixture();
    await setEditorSource(longSource);
    await waitMilliseconds(500);
    await clickNodeWithMouse("Q_CHOICE_ASK_YES");
    await waitMilliseconds(300);
    // Step: open the Destination list.
    await clickWithMouse("#destinationInput");
    // Step: read each row height, its text line height, and its position.
    const rows: { top: number; bottom: number; height: number; textHeight: number }[] = JSON.parse(await executeExpression(`JSON.stringify([...document.querySelectorAll('#destinationList [role="option"]')].map((row) => {
        const rect = row.getBoundingClientRect();
        const textRange = document.createRange();
        textRange.selectNodeContents(row);
        return { top: rect.top, bottom: rect.bottom, height: rect.height, textHeight: textRange.getBoundingClientRect().height };
    }))`));
    assert.ok(rows.length >= 30, `rows: ${rows.length}`);
    // Step: each row is at least as tall as its text.
    for (const row of rows)
        assert.ok(row.height >= row.textHeight, `row height ${row.height} is less than text height ${row.textHeight}`);
    // Step: no row overlaps the next row.
    for (let index = 0; index < rows.length - 1; index++)
        assert.ok(rows[index].bottom <= rows[index + 1].top + 0.01, `row ${index} bottom ${rows[index].bottom} is below row ${index + 1} top ${rows[index + 1].top}`);
});

test("test_destination_picker_input_has_a_label", async () => {
    // Step: select a choice.
    await selectChoiceWithDestinationPicker();
    // Step: the input is labelled by the "Destination:" text.
    assert.equal(await executeExpression("document.getElementById('destinationInput').labels[0].textContent.includes('Destination:')"), true);
});
