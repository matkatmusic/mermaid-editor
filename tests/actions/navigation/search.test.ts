import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression, waitForRender, waitMilliseconds } from "../../cdp.ts";
import { openEditorDrawer, selectEditorNode, setEditorSource } from "../../editor-helpers.ts";
import { SEARCH_FIXTURE } from "../../fixtures.ts";
import { nodeIsInMainView, searchState, startSearchTest, typeSearch } from "../../search-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test('test_search_field_sits_in_the_menu_bar_next_to_the_file_menu', async () => {
  // Step: the page is loaded and the search field is inside the header menu bar.
  assert.equal(await executeExpression("!!document.querySelector('#header #searchInput')"), true);
  // Step: the search controls come right after the File menu that holds New.
  assert.equal(await executeExpression("document.getElementById('searchControls').previousElementSibling.id"), 'fileMenu');
  // Step: with no text, the clear button, the cycle buttons, and the counter are hidden.
  await startSearchTest();
  const controls = await searchState();
  assert.equal(controls.clearHidden, true);
  assert.equal(controls.previousHidden, true);
  assert.equal(controls.nextHidden, true);
  assert.equal(controls.counterHidden, true);
});

test('test_search_by_node_text_is_case_insensitive_and_selects_the_first_hit', async () => {
  await startSearchTest();
  // Step: "DECISION" matches the text of Q_FIRST and Q_SECOND, and no node name.
  await typeSearch('DECISION');
  const controls = await searchState();
  // Step: the first hit in source order is selected and the selected item widget shows.
  assert.equal(controls.selected, 'Q_FIRST');
  assert.equal(controls.inspectorHidden, false);
  assert.equal(controls.counter, '1 / 2');
  // Step: the view jumps so the hit is inside the main view.
  assert.equal(await nodeIsInMainView('Q_FIRST'), true);
});

test('test_search_by_node_name_selects_and_jumps_to_the_node', async () => {
  await startSearchTest();
  // Step: "q_second" appears four times in the source (its definition and three edge lines).
  await typeSearch('q_second');
  const controls = await searchState();
  // Step: the first hit is selected, the selected item widget shows, and the hit is inside the main view.
  assert.equal(controls.selected, 'Q_SECOND');
  assert.equal(controls.inspectorHidden, false);
  assert.equal(controls.counter, '1 / 4');
  assert.equal(await nodeIsInMainView('Q_SECOND'), true);
});

test('test_each_search_keypress_reruns_the_search_and_jumps_to_the_new_first_hit', async () => {
  await startSearchTest();
  // Step: "s" selects its first hit, B_START.
  await typeSearch('s');
  assert.equal((await searchState()).selected, 'B_START');
  // Step: the next keypress "se" reruns the search and selects Q_SECOND.
  await typeSearch('se');
  const afterSecondKey = await searchState();
  assert.equal(afterSecondKey.selected, 'Q_SECOND');
  assert.equal(afterSecondKey.counter, '1 / 9');
  // Step: deleting a character reruns the search and goes back to B_START.
  await typeSearch('s');
  assert.equal((await searchState()).selected, 'B_START');
  // Step: two fast keypresses end on the hit of the last keypress, not on a stale earlier hit.
  await executeExpression(`(() => { const input = document.getElementById('searchInput'); input.value = 'st'; input.dispatchEvent(new Event('input', { bubbles: true })); input.value = 'se'; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await waitMilliseconds(600);
  assert.equal((await searchState()).selected, 'Q_SECOND');
});

test('test_search_cycle_buttons_show_only_for_two_or_more_hits_and_step_through_them', async () => {
  await startSearchTest();
  // Step: one hit keeps the cycle buttons hidden.
  await typeSearch('second decision');
  const oneHit = await searchState();
  assert.equal(oneHit.selected, 'Q_SECOND');
  assert.equal(oneHit.previousHidden, true);
  assert.equal(oneHit.nextHidden, true);
  assert.equal(oneHit.counter, '1 / 1');
  // Step: two hits show the cycle buttons.
  await typeSearch('decision');
  const twoHits = await searchState();
  assert.equal(twoHits.previousHidden, false);
  assert.equal(twoHits.nextHidden, false);
  assert.equal(twoHits.selected, 'Q_FIRST');
  // Step: Next steps to the second hit and keeps the selected item widget open.
  await executeExpression("document.getElementById('searchNextBtn').click()");
  // A second render started before the click's own render ends discards the click's centering.
  await waitMilliseconds(500);
  await waitForRender();
  const second = await searchState();
  assert.equal(second.selected, 'Q_SECOND');
  assert.equal(second.counter, '2 / 2');
  assert.equal(second.inspectorHidden, false);
  assert.equal(await nodeIsInMainView('Q_SECOND'), true);
  // Step: Next wraps from the last hit to the first hit.
  await executeExpression("document.getElementById('searchNextBtn').click()");
  await waitForRender();
  assert.equal((await searchState()).selected, 'Q_FIRST');
  // Step: Previous wraps from the first hit to the last hit.
  await executeExpression("document.getElementById('searchPreviousBtn').click()");
  await waitForRender();
  const wrapped = await searchState();
  assert.equal(wrapped.selected, 'Q_SECOND');
  assert.equal(wrapped.counter, '2 / 2');
  // Step: no hits hide the cycle buttons and show 0 / 0.
  await typeSearch('zzz');
  const noHits = await searchState();
  assert.equal(noHits.previousHidden, true);
  assert.equal(noHits.nextHidden, true);
  assert.equal(noHits.counter, '0 / 0');
  assert.equal(noHits.counterHidden, false);
});

test('test_remove_deletes_a_question_with_no_edges_and_the_search_count_drops_by_one', async () => {
  await startSearchTest();
  // Step: a question with no edges still has its definition line in the source.
  await setEditorSource(`${SEARCH_FIXTURE}\n  Q_LONELY{"Lonely decision"}`);
  // Step: searching "decision" finds the three questions.
  await typeSearch('decision');
  assert.equal((await searchState()).counter, '1 / 3');
  // Step: select the question with no edges and click Remove.
  await selectEditorNode('Q_LONELY');
  await executeExpression(`document.querySelector('#nodeInspectorActions button[data-action="remove"]').click(); window.editorActionPromise`);
  await waitMilliseconds(500);
  // Step: the definition line is gone from the source and the diagram.
  assert.equal(await executeExpression("codeBox.value.includes('Q_LONELY')"), false);
  assert.equal(await executeExpression("!!document.querySelector('#diagram [id*=\"flowchart-Q_LONELY-\"]')"), false);
  // Step: the search results count went down by one.
  assert.equal((await searchState()).counter, '1 / 2');
});

test('test_search_clear_button_shows_with_text_and_empties_the_field', async () => {
  await startSearchTest();
  // Step: text in the field shows the clear button.
  await typeSearch('decision');
  assert.equal((await searchState()).clearHidden, false);
  // Step: clicking clear empties the field and hides the clear button, the cycle buttons, and the counter.
  await executeExpression("document.getElementById('searchClearBtn').click()");
  await waitMilliseconds(100);
  const cleared = await searchState();
  assert.equal(cleared.value, '');
  assert.equal(cleared.clearHidden, true);
  assert.equal(cleared.previousHidden, true);
  assert.equal(cleared.nextHidden, true);
  assert.equal(cleared.counterHidden, true);
});
