import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerBrowserHooks } from '../../browser-harness.ts';
// import { executeExpression, waitMilliseconds } from '../../cdp.ts';
import { executeAndWaitForRender, executeExpression } from '../../cdp.ts';
import { openEditorDrawer, resetEditorFixture, setEditorSource } from '../../editor-helpers.ts';
import { clickNodeWithMouse } from '../../real-input.ts';
import { PATH_VIEW_SOURCE, clickButtonWithMouse, readErrorLog, readShownNodeIds } from '../../path-view-helpers.ts';

registerBrowserHooks(import.meta.url, openEditorDrawer);

const LOOP_SOURCE = [
    'flowchart TD',
    '  B_START["Start"]',
    '  Q_LOOP{{"Loop?"}}',
    '  Q_CHOICE_LOOP_A["A"]',
    '  Q_CHOICE_LOOP_B["B"]',
    '  Q_CHOICE_LOOP_EXIT["Exit"]',
    '  B_A["A block"]',
    '  B_B["B block"]',
    '  B_END["End"]',
    '  B_START --> Q_LOOP',
    '  Q_LOOP --> Q_CHOICE_LOOP_A',
    '  Q_LOOP --> Q_CHOICE_LOOP_B',
    '  Q_LOOP --> Q_CHOICE_LOOP_EXIT',
    '  Q_CHOICE_LOOP_A --> B_A',
    '  Q_CHOICE_LOOP_B --> B_B',
    '  Q_CHOICE_LOOP_EXIT --> B_END',
    '  B_A --> Q_LOOP',
    '  B_B --> Q_LOOP',
].join('\n');

async function loadFullDiagram(source: string = PATH_VIEW_SOURCE) {
    await resetEditorFixture();
    await setEditorSource(source);
    // await waitMilliseconds(500);
}

async function turnOnePathViewOn(source: string = PATH_VIEW_SOURCE) {
    await loadFullDiagram(source);
    await clickButtonWithMouse('#onePathViewBtn');
}

async function turnDownstreamToggleOn() {
    await loadFullDiagram();
    await clickButtonWithMouse('#downstreamViewBtn');
}

async function clickBlock(id: string) {
    await clickNodeWithMouse(id);
    // await waitMilliseconds(600);
}

async function tapPhone(selector: string) {
    // await executeExpression(`document.querySelector('#phoneDiagram ${selector}').click()`);
    // await waitMilliseconds(800);
    await executeAndWaitForRender(() => executeExpression(`document.querySelector('#phoneDiagram ${selector}').click()`));
}

const CHOOSE_YES = '[data-choose="Q_CHOICE_ASK_YES"]';
const CHOOSE_NO = '[data-choose="Q_CHOICE_ASK_NO"]';
const REVERT_TO_NO = '[data-revert$=":Q_CHOICE_ASK_NO"]';

// function readJson(expression: string) {
function readJson<Shape>(expression: string): Promise<Shape> {
    // return executeExpression(`JSON.stringify(${expression})`).then(JSON.parse);
    // return executeExpression<string>(`JSON.stringify(${expression})`).then(JSON.parse);
    return executeExpression<string>(`JSON.stringify(${expression})`).then((json) => JSON.parse(json) as Shape);
}

function readPhoneIds(selector: string): Promise<string[]> {
    return readJson(`[...document.querySelectorAll('#phoneDiagram ${selector}')].map((el) => el.dataset.nodeId)`);
}

function readPathLabel(): Promise<string> {
    return executeExpression("document.getElementById('viewPathLabel').textContent");
}

test('test_phone_view_shows_the_choices_of_the_shown_path', async () => {
    await turnOnePathViewOn();
    assert.deepEqual(await readPhoneIds('.phone-choice-chosen'), ['Q_CHOICE_ASK_YES']);
    assert.equal(await readErrorLog(), '');
});

test('test_phone_view_starts_at_the_first_block_of_the_shown_path', async () => {
    await turnOnePathViewOn();
    assert.equal((await readPhoneIds('[data-node-id]'))[0], 'B_START');
});

test('test_next_path_button_moves_the_phone_view_to_the_same_path', async () => {
    await turnOnePathViewOn();
    await clickButtonWithMouse('#nextViewPathBtn');
    assert.deepEqual(await readPhoneIds('.phone-choice-chosen'), ['Q_CHOICE_ASK_NO']);
    assert.ok((await readPhoneIds('[data-node-id]')).includes('B_NO'));
});

test('test_phone_view_follows_a_path_that_answers_one_decision_twice', async () => {
    await turnOnePathViewOn(LOOP_SOURCE);
    assert.deepEqual(await readPhoneIds('.phone-choice-chosen'), ['Q_CHOICE_LOOP_A', 'Q_CHOICE_LOOP_B', 'Q_CHOICE_LOOP_EXIT']);
    assert.equal(await readErrorLog(), '');
});

test('test_click_on_a_main_view_block_keeps_the_phone_view_on_the_shown_path', async () => {
    await turnOnePathViewOn();
    await clickBlock('B_START');
    assert.deepEqual(await readPhoneIds('.phone-choice-chosen'), ['Q_CHOICE_ASK_YES']);
});

test('test_phone_click_on_a_block_outside_the_view_raises_no_error', async () => {
    await turnOnePathViewOn();
    await executeExpression("window.capturedErrors = []; window.addEventListener('error', (event) => window.capturedErrors.push(String(event.message)));");
    // The phone shows only drawn blocks, so the row for a hidden block is made by hand.
    await executeExpression("(() => { const row = document.createElement('div'); row.className = 'phone-block'; row.dataset.nodeId = 'B_NO'; document.getElementById('phoneDiagram').append(row); row.click(); })()");
    // await waitMilliseconds(500);
    // assert.deepEqual(await readJson('window.capturedErrors'), []);
    assert.deepEqual(await readJson<string[]>('window.capturedErrors'), []);
});

test('test_phone_choice_tap_in_a_view_moves_the_main_view_to_that_path', async () => {
    await turnOnePathViewOn();
    // The next-decision button opens Q_ASK in the phone, with a button for each choice.
    await clickButtonWithMouse('#nextDecisionBtn');
    await tapPhone(CHOOSE_NO);
    assert.equal(await readPathLabel(), 'Path 0x01');
    assert.equal(await readErrorLog(), '');
});

test('test_phone_revert_tap_in_a_view_moves_the_main_view_to_that_path', async () => {
    await turnOnePathViewOn();
    await tapPhone(REVERT_TO_NO);
    assert.equal(await readPathLabel(), 'Path 0x01');
    assert.ok((await readShownNodeIds()).includes('B_NO'));
    assert.equal(await readErrorLog(), '');
});

test('test_phone_view_in_the_downstream_view_stops_at_the_latest_clicked_block_with_its_choices_open', async () => {
    await turnDownstreamToggleOn();
    await clickBlock('Q_ASK');
    assert.deepEqual(await readPhoneIds('[data-choose]'), ['Q_CHOICE_ASK_YES', 'Q_CHOICE_ASK_NO']);
    assert.deepEqual(await readPhoneIds('.phone-choice-chosen'), []);
});

test('test_downstream_toggle_with_no_filter_leaves_the_phone_view_unchanged', async () => {
    await loadFullDiagram();
    const before = await readPhoneIds('[data-node-id]');
    await clickButtonWithMouse('#downstreamViewBtn');
    assert.deepEqual(await readPhoneIds('[data-node-id]'), before);
});

test('test_phone_choice_tap_in_the_downstream_view_filters_on_that_choice', async () => {
    await turnDownstreamToggleOn();
    await clickBlock('Q_ASK');
    await tapPhone(CHOOSE_NO);
    // assert.deepEqual(await readJson('pathView.clickedIds'), ['Q_ASK', 'Q_CHOICE_ASK_NO']);
    assert.deepEqual(await readJson<string[]>('pathView.clickedIds'), ['Q_ASK', 'Q_CHOICE_ASK_NO']);
    assert.equal(await readErrorLog(), '');
});

test('test_phone_choice_tap_with_no_filter_starts_the_filter', async () => {
    await turnDownstreamToggleOn();
    await tapPhone(CHOOSE_NO);
    // assert.deepEqual(await readJson('pathView.clickedIds'), ['Q_CHOICE_ASK_NO']);
    assert.deepEqual(await readJson<string[]>('pathView.clickedIds'), ['Q_CHOICE_ASK_NO']);
});

// test('test_phone_revert_tap_with_no_filter_starts_the_filter', async () => {
//     await loadFullDiagram();
//     await tapPhone(CHOOSE_YES);
//     await clickButtonWithMouse('#downstreamViewBtn');
//     await tapPhone(REVERT_TO_NO);
//     assert.deepEqual(await readJson('pathView.clickedIds'), ['Q_ASK']);
// });

test('test_phone_revert_tap_in_the_downstream_view_filters_on_its_decision', async () => {
    await turnDownstreamToggleOn();
    await clickBlock('B_YES');
    await tapPhone(REVERT_TO_NO);
    // assert.deepEqual(await readJson('pathView.clickedIds'), ['Q_ASK']);
    assert.deepEqual(await readJson<string[]>('pathView.clickedIds'), ['Q_ASK']);
    assert.equal(await readErrorLog(), '');
});

test('test_back_after_a_phone_revert_tap_restores_the_earlier_click_list', async () => {
    await turnDownstreamToggleOn();
    await clickBlock('B_YES');
    await tapPhone(REVERT_TO_NO);
    await clickButtonWithMouse('#backDownstreamViewBtn');
    // assert.deepEqual(await readJson('pathView.clickedIds'), ['B_YES']);
    assert.deepEqual(await readJson<string[]>('pathView.clickedIds'), ['B_YES']);
});

test('test_phone_choice_tap_on_an_earlier_decision_switches_the_branch', async () => {
    await turnDownstreamToggleOn();
    await clickBlock('B_YES');
    await clickButtonWithMouse('#nextDecisionBtn');
    await tapPhone(CHOOSE_NO);
    // assert.deepEqual(await readJson('pathView.clickedIds'), ['Q_ASK', 'Q_CHOICE_ASK_NO']);
    assert.deepEqual(await readJson<string[]>('pathView.clickedIds'), ['Q_ASK', 'Q_CHOICE_ASK_NO']);
    assert.ok((await readShownNodeIds()).includes('B_NO'));
    assert.equal(await readErrorLog(), '');
});

test('test_back_after_a_branch_switch_restores_the_dropped_clicks', async () => {
    await turnDownstreamToggleOn();
    await clickBlock('B_YES');
    await clickButtonWithMouse('#nextDecisionBtn');
    await tapPhone(CHOOSE_NO);
    await clickButtonWithMouse('#backDownstreamViewBtn');
    // assert.deepEqual(await readJson('pathView.clickedIds'), ['B_YES']);
    assert.deepEqual(await readJson<string[]>('pathView.clickedIds'), ['B_YES']);
});

test('test_phone_undo_with_a_filter_does_the_view_back', async () => {
    await turnDownstreamToggleOn();
    await clickBlock('Q_ASK');
    await clickBlock('B_NO');
    await tapPhone('[data-undo]');
    // assert.deepEqual(await readJson('pathView.clickedIds'), ['Q_ASK']);
    assert.deepEqual(await readJson<string[]>('pathView.clickedIds'), ['Q_ASK']);
});

test('test_phone_reset_with_a_filter_does_the_view_reset', async () => {
    await turnDownstreamToggleOn();
    await clickBlock('B_YES');
    await tapPhone('[data-reset-decisions]');
    // assert.deepEqual(await readJson('[pathView.clickedIds, pathView.clickHistory]'), [[], []]);
    assert.deepEqual(await readJson<[string[], string[][]]>('[pathView.clickedIds, pathView.clickHistory]'), [[], []]);
    assert.equal(await executeExpression("document.getElementById('downstreamViewBtn').getAttribute('aria-pressed')"), 'true');
});

test('test_phone_undo_with_no_filter_removes_the_last_phone_answer', async () => {
    await loadFullDiagram();
    await tapPhone(CHOOSE_YES);
    await clickButtonWithMouse('#downstreamViewBtn');
    await tapPhone('[data-undo]');
    assert.deepEqual(await readPhoneIds('.phone-choice-chosen'), []);
    // assert.deepEqual(await readJson('pathView.clickedIds'), []);
    assert.deepEqual(await readJson<string[]>('pathView.clickedIds'), []);
});

// test('test_phone_undo_tap_in_the_one_path_view_keeps_the_shown_path', async () => {
//     await turnOnePathViewOn();
//     await tapPhone('[data-undo]');
//     assert.equal(await readPathLabel(), 'Path 0x00');
//     assert.deepEqual(await readPhoneIds('.phone-choice-chosen'), ['Q_CHOICE_ASK_YES']);
//     assert.equal(await readErrorLog(), '');
// });

// test('test_phone_reset_tap_in_the_one_path_view_keeps_the_shown_path', async () => {
//     await turnOnePathViewOn();
//     await tapPhone('[data-reset-decisions]');
//     assert.equal(await readPathLabel(), 'Path 0x00');
//     assert.deepEqual(await readPhoneIds('.phone-choice-chosen'), ['Q_CHOICE_ASK_YES']);
//     assert.equal(await readErrorLog(), '');
// });

// A second decision that only the No answer reaches.
const SECOND_DECISION_SOURCE = PATH_VIEW_SOURCE.replace('  B_NO --> B_END', [
    '  Q_SECOND{{"Second?"}}',
    '  Q_CHOICE_SECOND_A["A"]',
    '  Q_CHOICE_SECOND_B["B"]',
    '  B_NO --> Q_SECOND',
    '  Q_SECOND --> Q_CHOICE_SECOND_A',
    '  Q_SECOND --> Q_CHOICE_SECOND_B',
    '  Q_CHOICE_SECOND_A --> B_END',
    '  Q_CHOICE_SECOND_B --> B_END',
].join('\n'));

async function turnOnePathViewOnAtLastPath() {
    await turnOnePathViewOn(SECOND_DECISION_SOURCE);
    await clickButtonWithMouse('#nextViewPathBtn');
    await clickButtonWithMouse('#nextViewPathBtn');
    assert.equal(await readPathLabel(), 'Path 0x011');
}

function isPhoneButtonDisabled(selector: string): Promise<boolean> {
    return executeExpression(`document.querySelector('#phoneTopBar ${selector}').disabled`);
}

test('test_phone_revert_tap_with_no_filter_starts_no_filter', async () => {
    await loadFullDiagram();
    await tapPhone(CHOOSE_YES);
    await clickButtonWithMouse('#downstreamViewBtn');
    await tapPhone(REVERT_TO_NO);
    // assert.deepEqual(await readJson('pathView.clickedIds'), []);
    assert.deepEqual(await readJson<string[]>('pathView.clickedIds'), []);
    assert.deepEqual(await readPhoneIds('.phone-choice-chosen'), ['Q_CHOICE_ASK_NO']);
});

test('test_phone_undo_in_the_one_path_view_sets_the_last_answered_digit_to_0', async () => {
    await turnOnePathViewOnAtLastPath();
    await tapPhone('[data-undo]');
    assert.equal(await readPathLabel(), 'Path 0x010');
    assert.deepEqual(await readPhoneIds('.phone-choice-chosen'), ['Q_CHOICE_ASK_NO', 'Q_CHOICE_SECOND_A']);
    assert.equal(await readErrorLog(), '');
});

test('test_phone_reset_in_the_one_path_view_sets_every_digit_to_0', async () => {
    await turnOnePathViewOnAtLastPath();
    await tapPhone('[data-reset-decisions]');
    assert.equal(await readPathLabel(), 'Path 0x000');
    assert.deepEqual(await readPhoneIds('.phone-choice-chosen'), ['Q_CHOICE_ASK_YES']);
    assert.equal(await readErrorLog(), '');
});

test('test_a_revert_button_is_disabled_when_no_phone_choice_is_picked', async () => {
    await loadFullDiagram();
    assert.equal(await executeExpression("document.querySelectorAll('#phoneDiagram [data-revert]').length"), 0);
});

// Obsolete: Undo is now enabled when a filter exists, because it does the view Back.
// test('test_phone_top_bar_is_greyed_out_when_the_view_route_has_no_answered_decision', async () => {
//     await turnDownstreamToggleOn();
//     await clickBlock('B_START');
//     assert.equal(await isPhoneButtonDisabled('[data-undo]'), true);
//     assert.equal(await isPhoneButtonDisabled('[data-reset-decisions]'), true);
// });

// Obsolete name: Reset and Write path are now enabled here.
// test('test_phone_reset_and_write_path_are_greyed_out_when_the_view_route_has_no_answered_decision', async () => {
test('test_phone_reset_and_write_path_are_enabled_with_a_filter_and_no_answered_decision', async () => {
    await turnDownstreamToggleOn();
    await clickBlock('B_START');
    // Obsolete: a filter can be reset, and the shown blocks can be written.
    // assert.equal(await isPhoneButtonDisabled('[data-reset-decisions]'), true);
    // assert.equal(await isPhoneButtonDisabled('[data-write-path]'), true);
    assert.equal(await isPhoneButtonDisabled('[data-reset-decisions]'), false);
    assert.equal(await isPhoneButtonDisabled('[data-write-path]'), false);
});

test('test_phone_undo_with_a_filter_and_no_answered_decision_does_the_view_back', async () => {
    await turnDownstreamToggleOn();
    await clickBlock('B_START');
    assert.equal(await isPhoneButtonDisabled('[data-undo]'), false);
    await tapPhone('[data-undo]');
    // assert.deepEqual(await readJson('pathView.clickedIds'), []);
    assert.deepEqual(await readJson<string[]>('pathView.clickedIds'), []);
});

test('test_phone_view_shows_the_start_after_back_empties_the_filter', async () => {
    await turnDownstreamToggleOn();
    await clickBlock('B_YES');
    await clickButtonWithMouse('#backDownstreamViewBtn');
    assert.deepEqual(await readPhoneIds('.phone-choice-chosen'), []);
    assert.equal((await readPhoneIds('[data-node-id]'))[0], 'B_START');
    // Obsolete: the phone top bar is now always shown.
    // assert.equal(await executeExpression("!!document.querySelector('#phoneTopBar')"), false);
    assert.equal(await isPhoneButtonDisabled('[data-undo]'), true);
});

test('test_phone_view_shows_the_start_after_reset_empties_the_filter', async () => {
    await turnDownstreamToggleOn();
    await clickBlock('B_YES');
    await clickButtonWithMouse('#resetDownstreamViewBtn');
    assert.deepEqual(await readPhoneIds('.phone-choice-chosen'), []);
    // Obsolete: the phone top bar is now always shown.
    // assert.equal(await executeExpression("!!document.querySelector('#phoneTopBar')"), false);
    assert.equal(await isPhoneButtonDisabled('[data-undo]'), true);
});

// Obsolete name: Write path is now enabled here.
// test('test_phone_top_bar_is_greyed_out_in_the_full_diagram_with_no_answer', async () => {
test('test_phone_full_diagram_with_no_answer_greys_out_undo_and_reset_only', async () => {
    await loadFullDiagram();
    assert.equal(await isPhoneButtonDisabled('[data-undo]'), true);
    assert.equal(await isPhoneButtonDisabled('[data-reset-decisions]'), true);
    // Obsolete: Write path is enabled whenever the phone shows a block.
    // assert.equal(await isPhoneButtonDisabled('[data-write-path]'), true);
    assert.equal(await isPhoneButtonDisabled('[data-write-path]'), false);
});

test('test_phone_undo_in_the_one_path_view_skips_a_decision_whose_digit_is_0', async () => {
    await turnOnePathViewOn(SECOND_DECISION_SOURCE);
    await clickButtonWithMouse('#nextViewPathBtn');
    assert.equal(await readPathLabel(), 'Path 0x010');
    await tapPhone('[data-undo]');
    assert.equal(await readPathLabel(), 'Path 0x000');
    assert.equal(await readErrorLog(), '');
});

test('test_phone_undo_is_greyed_out_in_the_one_path_view_when_every_decision_digit_is_0', async () => {
    await turnOnePathViewOn();
    assert.equal(await isPhoneButtonDisabled('[data-undo]'), true);
    // Obsolete: every digit is 0, so there is nothing to reset.
    // assert.equal(await isPhoneButtonDisabled('[data-reset-decisions]'), false);
    assert.equal(await isPhoneButtonDisabled('[data-reset-decisions]'), true);
    assert.equal(await isPhoneButtonDisabled('[data-write-path]'), false);
});

const TWO_START_SOURCE = PATH_VIEW_SOURCE.replace('  B_START --> Q_ASK', [
    '  B_START --> Q_ASK',
    '  B_OTHER["Other"]',
    '  B_OTHER --> Q_ASK',
].join('\n'));

test('test_phone_undo_in_the_one_path_view_does_not_count_the_start_digit', async () => {
    await turnOnePathViewOn(TWO_START_SOURCE);
    await clickButtonWithMouse('#nextViewPathBtn');
    await clickButtonWithMouse('#nextViewPathBtn');
    assert.equal(await readPathLabel(), 'Path 0x10');
    assert.equal(await isPhoneButtonDisabled('[data-undo]'), true);
    assert.equal(await isPhoneButtonDisabled('[data-reset-decisions]'), false);
});
