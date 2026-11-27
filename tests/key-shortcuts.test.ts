import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitForRender } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { EDITOR_FIXTURE_NAME, SEARCH_FIXTURE } from "./fixtures.ts";
import { clickNodeWithMouse, KeyName, Modifier, pressKey } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const THREE_BLOCKS = 'flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_A --> B_B\n  B_B --> B_C';
const TWO_PARENTS = 'flowchart TD\n  B_X["X"]\n  B_Y["Y"]\n  B_M["M"]\n  B_X --> B_M\n  B_Y --> B_M';

function buildLongChain(length: number) {
  const declarations = Array.from({ length }, (_, index) => `  B_N${index}["N${index}"]`);
  const edges = Array.from({ length: length - 1 }, (_, index) => `  B_N${index} --> B_N${index + 1}`);
  return ["flowchart TD", ...declarations, ...edges].join("\n");
}

async function startShortcutTest(source: string) {
  await resetEditorFixture();
  await setEditorSource(source);
  // The page lives across tests, so forget the decision an earlier test stopped on.
  await executeExpression("selectEditorNode(null); currentDecisionId = null");
}

async function recordDefaultPreventedOnKeydown() {
  // The app listener was added first, so a later listener sees whether the app called preventDefault.
  await executeExpression(`window.defaultPreventedKeys = [];
    if (!window.isRecordingKeydown) {
      window.isRecordingKeydown = true;
      document.addEventListener('keydown', (event) => window.defaultPreventedKeys.push(event.defaultPrevented), false);
    }`);
}

// Task 52
test("test_cmd_s_saves_the_diagram_while_typing_in_the_source_editor", async () => {
  await startShortcutTest('flowchart TD\n  B_UNIQUE_SAVE_MARK["mark"]');
  // Step: before the key, the file on disk does not hold the typed text.
  // const fileBefore = await executeExpression(`fetch('/api/diagrams/${EDITOR_FIXTURE_NAME}').then((response) => response.text())`);
  const fileBefore = await executeExpression<string>(`fetch('/api/diagrams/${EDITOR_FIXTURE_NAME}').then((response) => response.text())`);
  assert.ok(!fileBefore.includes("B_UNIQUE_SAVE_MARK"));
  await executeExpression("codeBox.focus()");
  await pressKey(KeyName.S, Modifier.Meta);
  // const fileAfter = await executeExpression(`fetch('/api/diagrams/${EDITOR_FIXTURE_NAME}').then((response) => response.text())`);
  const fileAfter = await executeExpression<string>(`fetch('/api/diagrams/${EDITOR_FIXTURE_NAME}').then((response) => response.text())`);
  assert.ok(fileAfter.includes("B_UNIQUE_SAVE_MARK"));
});

test("test_cmd_s_blocks_the_browser_save_page_dialog", async () => {
  await startShortcutTest(THREE_BLOCKS);
  await recordDefaultPreventedOnKeydown();
  await pressKey(KeyName.S, Modifier.Meta);
  assert.deepEqual(await executeExpression("window.defaultPreventedKeys"), [true]);
});

// Task 53
test("test_cmd_f_puts_the_cursor_in_search_nodes_and_selects_its_text", async () => {
  await startShortcutTest(THREE_BLOCKS);
  await executeExpression("document.getElementById('searchInput').value = 'hello'; codeBox.focus()");
  await pressKey(KeyName.F, Modifier.Meta);
  // const state = await executeExpression("JSON.stringify({ id: document.activeElement.id, start: searchInput.selectionStart, end: searchInput.selectionEnd })");
  const state = await executeExpression<string>("JSON.stringify({ id: document.activeElement.id, start: searchInput.selectionStart, end: searchInput.selectionEnd })");
  // assert.deepEqual(JSON.parse(state), { id: "searchInput", start: 0, end: 5 });
  assert.deepEqual(JSON.parse(state) as { id: string; start: number | null; end: number | null }, { id: "searchInput", start: 0, end: 5 });
});

// Task 54
test("test_arrow_down_selects_the_node_the_selected_node_leads_to", async () => {
  await startShortcutTest(THREE_BLOCKS);
  await clickNodeWithMouse("B_A");
  await pressKey(KeyName.ArrowDown);
  assert.equal(await executeExpression("selectedEditorNodeId"), "B_B");
});

test("test_arrow_up_selects_the_node_that_leads_to_the_selected_node", async () => {
  await startShortcutTest(THREE_BLOCKS);
  await clickNodeWithMouse("B_C");
  await pressKey(KeyName.ArrowUp);
  assert.equal(await executeExpression("selectedEditorNodeId"), "B_B");
});

test("test_arrow_down_takes_the_first_node_in_edge_order_when_there_are_several", async () => {
  await startShortcutTest(SEARCH_FIXTURE);
  await clickNodeWithMouse("Q_FIRST");
  await pressKey(KeyName.ArrowDown);
  assert.equal(await executeExpression("selectedEditorNodeId"), "Q_CHOICE_FIRST_YES");
});

test("test_arrow_up_takes_the_first_node_in_edge_order_when_there_are_several", async () => {
  await startShortcutTest(TWO_PARENTS);
  await clickNodeWithMouse("B_M");
  await pressKey(KeyName.ArrowUp);
  assert.equal(await executeExpression("selectedEditorNodeId"), "B_X");
});

test("test_arrow_down_centers_the_newly_selected_node", async () => {
  await startShortcutTest(buildLongChain(40));
  await clickNodeWithMouse("B_N5");
  for (let step = 0; step < 14; step++)
    await pressKey(KeyName.ArrowDown);
  assert.equal(await executeExpression("selectedEditorNodeId"), "B_N19");
  // const offsetFromCenter = await executeExpression(`(() => {
  const offsetFromCenter = await executeExpression<number>(`(() => {
    const output = document.getElementById('output').getBoundingClientRect();
    const node = document.querySelector('#diagram [id*="flowchart-B_N19-"]').getBoundingClientRect();
    return Math.abs(node.top + node.height / 2 - (output.top + output.height / 2));
  })()`);
  assert.ok(offsetFromCenter < 20, `node is ${offsetFromCenter}px from the center`);
});

test("test_arrow_down_does_nothing_while_focus_is_in_a_text_box", async () => {
  await startShortcutTest(THREE_BLOCKS);
  await clickNodeWithMouse("B_A");
  await executeExpression("document.getElementById('nodeTextInput').focus()");
  await pressKey(KeyName.ArrowDown);
  assert.equal(await executeExpression("selectedEditorNodeId"), "B_A");
});

// Task 55
test("test_cmd_equal_zooms_in_like_the_plus_button", async () => {
  await startShortcutTest(THREE_BLOCKS);
  const zoomBefore: number = await executeExpression("mainZoomPercent");
  await pressKey(KeyName.Equal, Modifier.Meta);
  assert.equal(await executeExpression("mainZoomPercent"), zoomBefore + 10);
});

test("test_cmd_plus_zooms_in_like_the_plus_button", async () => {
  await startShortcutTest(THREE_BLOCKS);
  const zoomBefore: number = await executeExpression("mainZoomPercent");
  await pressKey(KeyName.Plus, Modifier.Meta | Modifier.Shift);
  assert.equal(await executeExpression("mainZoomPercent"), zoomBefore + 10);
});

test("test_cmd_minus_zooms_out_like_the_minus_button", async () => {
  await startShortcutTest(THREE_BLOCKS);
  const zoomBefore: number = await executeExpression("mainZoomPercent");
  await pressKey(KeyName.Minus, Modifier.Meta);
  assert.equal(await executeExpression("mainZoomPercent"), zoomBefore - 10);
});

test("test_cmd_minus_blocks_the_browser_page_zoom", async () => {
  await startShortcutTest(THREE_BLOCKS);
  await recordDefaultPreventedOnKeydown();
  await pressKey(KeyName.Minus, Modifier.Meta);
  assert.deepEqual(await executeExpression("window.defaultPreventedKeys"), [true]);
});

// Task 56
test("test_greater_than_goes_to_the_next_question_like_the_right_arrow_button", async () => {
  await startShortcutTest(SEARCH_FIXTURE);
  await executeExpression("document.getElementById('nextDecisionBtn').click()");
  const expected = await executeExpression("selectedEditorNodeId");
  assert.ok(expected);
  await startShortcutTest(SEARCH_FIXTURE);
  await pressKey(KeyName.GreaterThan, Modifier.Shift);
  assert.equal(await executeExpression("selectedEditorNodeId"), expected);
});

test("test_less_than_goes_to_the_previous_question_like_the_left_arrow_button", async () => {
  await startShortcutTest(SEARCH_FIXTURE);
  for (const buttonId of ["nextDecisionBtn", "nextDecisionBtn", "previousDecisionBtn"]) {
    await executeExpression(`document.getElementById('${buttonId}').click()`);
    await waitForRender();
  }
  const expected = await executeExpression("selectedEditorNodeId");
  await startShortcutTest(SEARCH_FIXTURE);
  await pressKey(KeyName.GreaterThan, Modifier.Shift);
  await pressKey(KeyName.GreaterThan, Modifier.Shift);
  await pressKey(KeyName.LessThan, Modifier.Shift);
  assert.equal(await executeExpression("selectedEditorNodeId"), expected);
});

test("test_greater_than_does_nothing_while_focus_is_in_a_text_box", async () => {
  await startShortcutTest(SEARCH_FIXTURE);
  await executeExpression("document.getElementById('nodeTextInput').focus()");
  await pressKey(KeyName.GreaterThan, Modifier.Shift);
  assert.equal(await executeExpression("selectedEditorNodeId"), null);
});
