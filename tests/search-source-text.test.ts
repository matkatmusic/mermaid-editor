import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitForRender, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer } from "./editor-helpers.ts";
import { SEARCH_FIXTURE } from "./fixtures.ts";
import { nodeIsInMainView, searchState, startSearchTest } from "./search-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const BROKEN_SOURCE = SEARCH_FIXTURE + "\n  Q_UNDECLARED --> B_START";

async function typeIntoSearchBox(query: string) {
  // Scenario: real keystrokes in the Search box, one key at a time.
  await executeExpression("(() => { const input = document.getElementById('searchInput'); input.focus(); input.select(); })()");
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
  for (const character of query)
    await send("Input.dispatchKeyEvent", { type: "char", text: character, key: character });
  await waitMilliseconds(500);
  await waitForRender();
}

async function clickSearchButton(id: string) {
  await executeExpression(`document.getElementById('${id}').click()`);
  await waitMilliseconds(500);
}

async function readSourceSelection(): Promise<{ start: number; end: number; text: string }> {
  return executeExpression("JSON.stringify({ start: codeBox.selectionStart, end: codeBox.selectionEnd, text: codeBox.value.slice(codeBox.selectionStart, codeBox.selectionEnd) })").then(JSON.parse);
}

async function listMatchStarts(source: string, query: string): Promise<number[]> {
  const starts: number[] = [];
  let from = source.toLowerCase().indexOf(query.toLowerCase());
  while (from !== -1) {
    starts.push(from);
    from = source.toLowerCase().indexOf(query.toLowerCase(), from + query.length);
  }
  return starts;
}

test("test_search_works_in_the_source_text_when_the_diagram_has_a_parse_error", async () => {
  // Scenario: the source has an undeclared node, so getEditorGraph() throws; the search still finds, steps and wraps.
  await startSearchTest();
  await executeExpression(`window.capturedErrors = []; window.addEventListener('error', (event) => window.capturedErrors.push(String(event.message))); window.addEventListener('unhandledrejection', (event) => window.capturedErrors.push('rejection: ' + String(event.reason && event.reason.message || event.reason))); codeBox.value = ${JSON.stringify(BROKEN_SOURCE)};`);
  const starts = await listMatchStarts(BROKEN_SOURCE, "decision");
  assert.equal(starts.length, 2);
  await typeIntoSearchBox("decision");
  // Step: the counter counts source occurrences and the first one is selected in the source editor.
  assert.equal((await searchState()).counter, "1 / 2");
  assert.deepEqual(await readSourceSelection(), { start: starts[0], end: starts[0] + "decision".length, text: "decision" });
  // Step: the cursor stays in the Search box.
  assert.equal(await executeExpression("document.activeElement.id"), "searchInput");
  // Step: next goes to the second occurrence, next again wraps to the first, previous wraps to the second.
  await clickSearchButton("searchNextBtn");
  assert.equal((await readSourceSelection()).start, starts[1]);
  assert.equal((await searchState()).counter, "2 / 2");
  await clickSearchButton("searchNextBtn");
  assert.equal((await readSourceSelection()).start, starts[0]);
  await clickSearchButton("searchPreviousBtn");
  assert.equal((await readSourceSelection()).start, starts[1]);
  // Step: the clear button empties the box.
  await clickSearchButton("searchClearBtn");
  assert.equal((await searchState()).value, "");
  assert.deepEqual(await executeExpression("JSON.stringify(window.capturedErrors)").then(JSON.parse), []);
});

test("test_search_opens_the_closed_drawer_to_show_the_match", async () => {
  // Scenario: the drawer is closed; typing a query opens it.
  await startSearchTest();
  await executeExpression("document.getElementById('drawer').classList.contains('closed') || document.getElementById('drawerToggle').click()");
  assert.equal(await executeExpression("document.getElementById('drawer').classList.contains('closed')"), true);
  await typeIntoSearchBox("middle");
  assert.equal(await executeExpression("document.getElementById('drawer').classList.contains('closed')"), false);
});

test("test_search_scrolls_the_source_editor_to_a_match_far_down", async () => {
  // Scenario: the only match is a comment line 200 lines down, so the source editor must scroll to show it.
  await startSearchTest();
  const fillerLines = Array.from({ length: 200 }, (_, index) => `%% filler ${index}`).join("\n");
  await executeExpression(`codeBox.value = ${JSON.stringify(SEARCH_FIXTURE + "\n" + fillerLines + "\n%% zebra")}; codeBox.scrollTop = 0;`);
  await typeIntoSearchBox("zebra");
  assert.equal((await searchState()).counter, "1 / 1");
  assert.ok(await executeExpression("codeBox.scrollTop > 0"));
});

test("test_search_counts_every_source_occurrence_as_one_match", async () => {
  // Scenario: Q_FIRST appears on its definition line and on three edge lines.
  await startSearchTest();
  await typeIntoSearchBox("q_first");
  assert.equal((await searchState()).counter, "1 / 4");
});

test("test_search_match_on_a_node_definition_line_selects_and_centers_that_node", async () => {
  // Scenario: the first "q_second" is on the definition line of Q_SECOND.
  await startSearchTest();
  await typeIntoSearchBox("q_second");
  assert.equal((await searchState()).selected, "Q_SECOND");
  assert.equal(await nodeIsInMainView("Q_SECOND"), true);
});

test("test_search_match_inside_an_edge_line_selects_the_node_the_match_is_inside", async () => {
  // Scenario: the second "q_first" is on the edge "B_START --> Q_FIRST", inside the Q_FIRST part, not the first node of the line.
  await startSearchTest();
  await typeIntoSearchBox("q_first");
  await clickSearchButton("searchNextBtn");
  assert.equal((await searchState()).counter, "2 / 4");
  assert.equal((await searchState()).selected, "Q_FIRST");
});

test("test_search_match_outside_every_node_part_selects_the_first_node_of_the_line", async () => {
  // Scenario: "-->" is not inside any node part; the first "-->" is on "B_START --> Q_FIRST", so B_START is selected.
  await startSearchTest();
  await typeIntoSearchBox("-->");
  assert.equal((await searchState()).selected, "B_START");
});
