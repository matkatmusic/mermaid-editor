import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { EDITOR_FIXTURE_NAME } from "./fixtures.ts";
import { clickNodeWithMouse, Modifier } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const THREE_BLOCKS = 'flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_A --> B_B';

async function getCodeBoxSource(): Promise<string> {
    return executeExpression("codeBox.value");
}

async function getSelectedNodeId(): Promise<string | null> {
    return executeExpression("state.selectedEditorNodeId");
}

async function getTextSelectionState(): Promise<{ codeBoxStart: number; codeBoxEnd: number; codeBoxIsFocused: boolean; pageSelectionLength: number }> {
    const json: string = await executeExpression(`JSON.stringify({
        codeBoxStart: codeBox.selectionStart,
        codeBoxEnd: codeBox.selectionEnd,
        codeBoxIsFocused: document.activeElement === codeBox,
        pageSelectionLength: window.getSelection().toString().length,
    })`);
    return JSON.parse(json);
}

// This test stays first in the file: it needs a page that holds no pick from an earlier test.
test("test_real_mouse_a_pick_does_not_survive_a_diagram_load", async () => {
    // Step: Shift-click B_C starts a pick.
    await resetEditorFixture();
    await setEditorSource(THREE_BLOCKS);
    await clickNodeWithMouse("B_C", Modifier.Shift);
    // Step: a diagram load, as the Diagrams list does.
    await executeExpression(`loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`);
    await setEditorSource(THREE_BLOCKS);
    // Step: Shift-click B_A. The load cancelled the pick, so B_C --> B_A is not added.
    await clickNodeWithMouse("B_A", Modifier.Shift);
    await waitMilliseconds(500);
    const source = await getCodeBoxSource();
    assert.ok(!source.includes("B_C --> B_A"), source);
});

test("test_real_mouse_plain_click_on_a_then_shift_click_on_b_adds_an_edge_from_a_to_b", async () => {
    // Step: three blocks; only B_A --> B_B exists. Click B_C with no Shift, then Shift-click B_A.
    await resetEditorFixture();
    await setEditorSource(THREE_BLOCKS);
    await clickNodeWithMouse("B_C", Modifier.None);
    await clickNodeWithMouse("B_A", Modifier.Shift);
    await waitMilliseconds(500);
    // Step: the source gained `B_C --> B_A` and kept `B_A --> B_B`.
    const source = await getCodeBoxSource();
    assert.ok(source.includes("B_C --> B_A"), source);
    assert.ok(source.includes("B_A --> B_B"), source);
});

test("test_real_mouse_shift_click_makes_no_text_selection_after_a_plain_click", async () => {
    // Step: plain click on B_C; the editor selects the source line of B_C in the Editor drawer.
    await resetEditorFixture();
    await setEditorSource(THREE_BLOCKS);
    await clickNodeWithMouse("B_C", Modifier.None);
    const selectionAfterPlainClick = await getTextSelectionState();
    // Step: Shift-click B_A.
    await clickNodeWithMouse("B_A", Modifier.Shift);
    await waitMilliseconds(500);
    // Step: the link rewrote the source, so the Editor drawer holds no selected range, is not focused, and the page has no text selection.
    assert.ok(selectionAfterPlainClick.codeBoxEnd > selectionAfterPlainClick.codeBoxStart);
    const selectionAfterShiftClick = await getTextSelectionState();
    assert.equal(selectionAfterShiftClick.codeBoxEnd, selectionAfterShiftClick.codeBoxStart);
    assert.equal(selectionAfterShiftClick.codeBoxIsFocused, false);
    assert.equal(selectionAfterShiftClick.pageSelectionLength, 0);
});

test("test_real_mouse_shift_click_makes_no_text_selection_after_a_plain_click_and_a_link", async () => {
    // Step: plain click on B_A, then Shift-click B_C twice with a link between the two Shift-clicks.
    await resetEditorFixture();
    await setEditorSource(THREE_BLOCKS);
    await clickNodeWithMouse("B_A", Modifier.None);
    await clickNodeWithMouse("B_C", Modifier.Shift);
    await waitMilliseconds(500);
    const selectionAfterLink = await getTextSelectionState();
    // Step: the link did not leave a selection of the whole source in the Editor drawer.
    assert.equal(selectionAfterLink.codeBoxIsFocused, false);
    assert.equal(selectionAfterLink.pageSelectionLength, 0);
});

test("test_real_mouse_shift_click_with_no_selected_node_starts_a_pick_and_adds_no_edge", async () => {
    // Step: no node is selected. Shift-click B_C.
    await resetEditorFixture();
    await setEditorSource(THREE_BLOCKS);
    await clickNodeWithMouse("B_C", Modifier.Shift);
    await waitMilliseconds(500);
    // Step: B_C is selected and the source has no new edge.
    assert.equal(await getSelectedNodeId(), "B_C");
    const source = await getCodeBoxSource();
    assert.ok(!source.includes("B_C -->"), source);
});

test("test_real_mouse_shift_click_on_the_selected_node_adds_no_edge_and_keeps_it_selected", async () => {
    // Step: plain click on B_C, then Shift-click B_C.
    await resetEditorFixture();
    await setEditorSource(THREE_BLOCKS);
    await clickNodeWithMouse("B_C", Modifier.None);
    await clickNodeWithMouse("B_C", Modifier.Shift);
    await waitMilliseconds(500);
    // Step: no `B_C --> B_C`, and B_C is still selected.
    const source = await getCodeBoxSource();
    assert.ok(!source.includes("B_C --> B_C"), source);
    assert.equal(await getSelectedNodeId(), "B_C");
});

test("test_real_mouse_the_from_node_stays_selected_after_a_link", async () => {
    // Step: plain click on B_C, then Shift-click B_A. The link B_C --> B_A is added.
    await resetEditorFixture();
    await setEditorSource(THREE_BLOCKS);
    await clickNodeWithMouse("B_C", Modifier.None);
    await clickNodeWithMouse("B_A", Modifier.Shift);
    await waitMilliseconds(500);
    // Step: B_C, the node that the link starts from, is still the selected node.
    assert.ok((await getCodeBoxSource()).includes("B_C --> B_A"));
    assert.equal(await getSelectedNodeId(), "B_C");
});
