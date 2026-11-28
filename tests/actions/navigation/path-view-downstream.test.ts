import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerBrowserHooks, SERVER_PORT } from '../../browser-harness.ts';
// import { executeExpression, send, waitMilliseconds } from '../../cdp.ts';
import { executeExpression, send, waitForEditorAction, waitForExpression } from '../../cdp.ts';
import { openEditorDrawer, resetEditorFixture, setEditorSource } from '../../editor-helpers.ts';
import { clickInspectorAction } from '../../inspector-helpers.ts';
import { KeyName, Modifier, clickNodeWithMouse, pressKey } from '../../real-input.ts';
import { PATH_VIEW_SOURCE, clickButtonWithMouse, readErrorLog, readShownNodeIds } from '../../path-view-helpers.ts';

registerBrowserHooks(import.meta.url, openEditorDrawer);

const ALL_NODE_IDS = ['B_END', 'B_NO', 'B_START', 'B_YES', 'Q_ASK', 'Q_CHOICE_ASK_NO', 'Q_CHOICE_ASK_YES'];
const YES_NODE_IDS = ['B_END', 'B_START', 'B_YES', 'Q_ASK', 'Q_CHOICE_ASK_YES'];
const NO_NODE_IDS = ['B_END', 'B_NO', 'B_START', 'Q_ASK', 'Q_CHOICE_ASK_NO'];

async function loadFullDiagram() {
    await resetEditorFixture();
    await setEditorSource(PATH_VIEW_SOURCE);
    // await waitMilliseconds(500);
}

async function turnToggleOn() {
    await loadFullDiagram();
    await clickButtonWithMouse('#downstreamViewBtn');
}

async function clickFilter(id: string) {
    await clickNodeWithMouse(id);
    // await waitMilliseconds(600);
}

async function selectBlock(id: string) {
    await executeExpression(`selectEditorNode('${id}')`);
}

async function runInspectorAction(action: string) {
    await clickInspectorAction(action);
    // await waitMilliseconds(600);
}

function readJson(expression: string) {
//    return executeExpression(`JSON.stringify(${expression})`).then(JSON.parse);
    return executeExpression<string>(`JSON.stringify(${expression})`).then((json): string[] => JSON.parse(json));
}

function isDisabled(selector: string): Promise<boolean> {
    return executeExpression(`document.querySelector('${selector}').disabled`);
}

function isSourceReadOnly(): Promise<boolean> {
    return executeExpression('codeBox.readOnly');
}

function readSource(): Promise<string> {
    return executeExpression('codeBox.value');
}

function readTogglePressed(): Promise<string> {
    return executeExpression("document.getElementById('downstreamViewBtn').getAttribute('aria-pressed')");
}

async function assertShown(expectedIds: string[]) {
    assert.deepEqual(await readShownNodeIds(), expectedIds);
    assert.equal(await readErrorLog(), '');
}

async function assertViewIsOff() {
    assert.equal(await readTogglePressed(), 'false');
    assert.equal(await executeExpression("document.getElementById('downstreamViewControls').hidden"), true);
    assert.equal(await isSourceReadOnly(), false);
    assert.equal(await readErrorLog(), '');
}

async function renameSelectedBlock(namePart: string) {
    await executeExpression("(() => { const input = document.getElementById('nodeNameInput'); input.focus(); input.select(); })()");
    for (const character of namePart)
        await send('Input.dispatchKeyEvent', { type: 'char', text: character, key: character });
    await pressKey(KeyName.Tab);
    await executeExpression('window.editorActionPromise');
    // await waitMilliseconds(600);
}

async function dispatchShiftClick(id: string) {
    await executeExpression(`document.querySelector('#diagram [id*="flowchart-${id}-"]').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))`);
    // await waitMilliseconds(600);
    await waitForEditorAction();
}

test('test_block_click_with_the_downstream_toggle_off_only_selects_the_block', async () => {
    await loadFullDiagram();
    await clickFilter('B_YES');
    await assertShown(ALL_NODE_IDS);
    assert.equal(await executeExpression('selectedEditorNodeId'), 'B_YES');
});

test('test_downstream_toggle_alone_draws_the_full_diagram', async () => {
    await turnToggleOn();
    assert.equal(await readTogglePressed(), 'true');
    await assertShown(ALL_NODE_IDS);
});

test('test_first_click_draws_the_route_from_start_and_all_later_blocks', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    await assertShown(YES_NODE_IDS);
});

test('test_downstream_view_leaves_out_the_other_branch_before_the_clicked_block', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    const shownIds = await readShownNodeIds();
    assert.ok(!shownIds.includes('B_NO'));
    assert.ok(!shownIds.includes('Q_CHOICE_ASK_NO'));
});

test('test_downstream_view_draws_every_branch_after_a_decision', async () => {
    await turnToggleOn();
    await clickFilter('Q_ASK');
    await assertShown(ALL_NODE_IDS);
});

test('test_deeper_click_narrows_the_view', async () => {
    await turnToggleOn();
    await clickFilter('Q_ASK');
    await clickFilter('B_NO');
    await assertShown(NO_NODE_IDS);
});

test('test_click_on_a_route_block_widens_the_view_to_that_block', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    await clickFilter('Q_ASK');
    await assertShown(ALL_NODE_IDS);
});

test('test_back_button_undoes_the_last_filter_click', async () => {
    await turnToggleOn();
    await clickFilter('Q_ASK');
    await clickFilter('B_NO');
    await clickButtonWithMouse('#backDownstreamViewBtn');
    await assertShown(ALL_NODE_IDS);
    assert.deepEqual(await readJson('pathView.clickedIds'), ['Q_ASK']);
});

test('test_back_after_a_route_click_restores_the_earlier_click_list', async () => {
    await turnToggleOn();
    await clickFilter('Q_ASK');
    await clickFilter('B_NO');
    await clickFilter('Q_ASK');
    await clickButtonWithMouse('#backDownstreamViewBtn');
    await assertShown(NO_NODE_IDS);
    assert.deepEqual(await readJson('pathView.clickedIds'), ['Q_ASK', 'B_NO']);
});

test('test_back_walks_each_filter_state_to_no_filter', async () => {
    await turnToggleOn();
    await clickFilter('Q_ASK');
    await clickFilter('B_NO');
    await clickButtonWithMouse('#backDownstreamViewBtn');
    await clickButtonWithMouse('#backDownstreamViewBtn');
    await assertShown(ALL_NODE_IDS);
    assert.deepEqual(await readJson('pathView.clickedIds'), []);
    assert.equal(await isDisabled('#backDownstreamViewBtn'), true);
});

test('test_filter_click_on_the_latest_block_adds_no_history_step', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    await clickFilter('B_YES');
    await clickButtonWithMouse('#backDownstreamViewBtn');
    assert.equal(await isDisabled('#backDownstreamViewBtn'), true);
});

test('test_back_button_is_disabled_with_no_filter', async () => {
    await turnToggleOn();
    assert.equal(await isDisabled('#backDownstreamViewBtn'), true);
});

test('test_reset_button_draws_the_full_diagram_and_keeps_the_toggle_on', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    await clickButtonWithMouse('#resetDownstreamViewBtn');
    await assertShown(ALL_NODE_IDS);
    assert.equal(await readTogglePressed(), 'true');
});

test('test_reset_button_clears_the_history', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    await clickButtonWithMouse('#resetDownstreamViewBtn');
    assert.equal(await isDisabled('#backDownstreamViewBtn'), true);
});

test('test_downstream_toggle_off_restores_the_full_diagram', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    await clickButtonWithMouse('#downstreamViewBtn');
    await assertShown(ALL_NODE_IDS);
    await assertViewIsOff();
});

test('test_downstream_view_shows_no_path_buttons', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    assert.equal(await executeExpression("document.getElementById('pathViewControls').hidden"), true);
    assert.equal(await isDisabled('#onePathViewBtn'), true);
});

test('test_filter_click_selects_the_block', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    assert.equal(await executeExpression('selectedEditorNodeId'), 'B_YES');
});

test('test_add_choice_in_the_downstream_view_keeps_the_shown_path', async () => {
    await turnToggleOn();
    await clickFilter('Q_ASK');
    await runInspectorAction('add-choice');
    assert.deepEqual(await readJson('pathView.protectedIds'), ['B_START', 'Q_ASK']);
    assert.equal((await readShownNodeIds()).length, ALL_NODE_IDS.length + 1);
    assert.equal(await readErrorLog(), '');
});

test('test_downstream_view_draws_a_block_inserted_after_the_latest_clicked_block', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    await runInspectorAction('insert-static-after');
    assert.ok((await readShownNodeIds()).includes('B_NEW_1'));
    assert.equal(await readErrorLog(), '');
});

test('test_downstream_view_follows_a_rename_of_a_clicked_block', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    await renameSelectedBlock('AGREED');
    assert.deepEqual(await readJson('pathView.clickedIds'), ['B_AGREED']);
    assert.ok((await readShownNodeIds()).includes('B_AGREED'));
    assert.equal(await readErrorLog(), '');
});

test('test_back_after_a_rename_restores_the_renamed_click_list', async () => {
    await turnToggleOn();
    await clickFilter('Q_ASK');
    await clickFilter('B_YES');
    await clickFilter('B_END');
    await selectBlock('B_YES');
    await renameSelectedBlock('AGREED');
    await clickButtonWithMouse('#backDownstreamViewBtn');
    assert.deepEqual(await readJson('pathView.clickedIds'), ['Q_ASK', 'B_AGREED']);
    assert.equal(await readErrorLog(), '');
});

test('test_downstream_view_turns_off_when_undo_takes_a_clicked_block_away', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    await runInspectorAction('insert-static-after');
    await clickFilter('B_NEW_1');
    await executeExpression("document.getElementById('editorUndoBtn').click()");
    // await waitMilliseconds(800);
    await waitForEditorAction();
    await assertViewIsOff();
});

test('test_downstream_view_turns_off_when_the_latest_clicked_block_is_removed', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    await runInspectorAction('remove');
    await assertViewIsOff();
});

test('test_downstream_view_turns_off_when_an_edit_removes_an_earlier_clicked_block', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    await clickFilter('B_END');
    await selectBlock('B_YES');
    await runInspectorAction('remove');
    await assertViewIsOff();
});

test('test_downstream_view_refuses_to_remove_a_selected_block_that_another_rule_blocks', async () => {
    await turnToggleOn();
    await clickFilter('B_END');
    assert.equal(await isDisabled('[data-action="remove"]'), true);
});

test('test_inspector_buttons_are_enabled_with_no_filter', async () => {
    await turnToggleOn();
    await selectBlock('Q_ASK');
    assert.equal(await isDisabled('[data-action="remove"]'), false);
});

test('test_first_filter_click_disables_the_refused_buttons', async () => {
    await turnToggleOn();
    await clickFilter('Q_ASK');
    assert.equal(await isDisabled('[data-action="remove"]'), true);
});

test('test_source_editor_accepts_typing_with_no_filter', async () => {
    await turnToggleOn();
    assert.equal(await isSourceReadOnly(), false);
});

test('test_first_filter_click_locks_the_source_editor', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    assert.equal(await isSourceReadOnly(), true);
});

test('test_back_to_no_filter_unlocks_the_source_editor', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    await clickButtonWithMouse('#backDownstreamViewBtn');
    assert.equal(await isSourceReadOnly(), false);
});

test('test_reset_button_unlocks_the_source_editor', async () => {
    await turnToggleOn();
    await clickFilter('B_YES');
    await clickButtonWithMouse('#resetDownstreamViewBtn');
    assert.equal(await isSourceReadOnly(), false);
});

test('test_export_with_no_filter_leaves_the_source_editor_unlocked', async () => {
    await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/downstream-export.mmd`, { method: 'PUT', body: PATH_VIEW_SOURCE });
    await executeExpression("loadDiagram('downstream-export.mmd')");
    // await waitMilliseconds(500);
    await clickButtonWithMouse('#downstreamViewBtn');
    await executeExpression("document.getElementById('exportAllPathsBtn').click()");
    // await waitMilliseconds(1500);
    await waitForExpression("document.getElementById('status').textContent === 'Wrote 2 paths'");
    assert.equal(await executeExpression("document.getElementById('status').textContent"), 'Wrote 2 paths');
    assert.equal(await isSourceReadOnly(), false);
});

test('test_destination_row_shows_with_no_filter', async () => {
    await turnToggleOn();
    await selectBlock('B_YES');
    assert.equal(await executeExpression("document.getElementById('destinationRow').hidden"), false);
});

test('test_insert_decision_after_with_no_filter_keeps_two_choices', async () => {
    await turnToggleOn();
    await selectBlock('B_YES');
    await runInspectorAction('insert-decision-after');
    assert.ok((await readSource()).includes('Q_NEW_1 --> Q_CHOICE_NEW_1_N'));
});

test('test_add_decision_after_with_no_filter_replaces_the_destination', async () => {
    await turnToggleOn();
    await selectBlock('B_YES');
    await runInspectorAction('add-decision-after');
    assert.ok((await readSource()).includes('Q_NEW_1 --> Q_CHOICE_NEW_1_N'));
});

test('test_delete_key_removes_a_decision_with_no_filter', async () => {
    await turnToggleOn();
    await clickNodeWithMouse('Q_ASK', Modifier.Meta);
    await pressKey(KeyName.Delete);
    // await waitMilliseconds(600);
    assert.ok(!(await readSource()).includes('Q_ASK{{'));
});

test('test_shift_click_adds_an_arrow_with_no_filter', async () => {
    await turnToggleOn();
    await selectBlock('B_END');
    await dispatchShiftClick('B_NO');
    assert.ok((await readSource()).includes('B_END --> B_NO'));
});

test('test_right_click_opens_the_add_block_menu_with_no_filter', async () => {
    await turnToggleOn();
//    const point = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const point: { x: number; y: number } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const rect = document.getElementById('output').getBoundingClientRect();
        return { x: rect.left + 30, y: rect.top + 30 };
    })())`));
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'right', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'right', clickCount: 1 });
    // await waitMilliseconds(200);
    assert.equal(await executeExpression("document.getElementById('viewportMenu').hidden"), false);
    await executeExpression("document.getElementById('viewportMenu').hidden = true");
});

test('test_shift_click_in_the_downstream_view_does_not_filter', async () => {
    await turnToggleOn();
    await executeExpression('selectEditorNode(null)');
    await dispatchShiftClick('B_YES');
    assert.deepEqual(await readJson('pathView.clickedIds'), []);
    await assertShown(ALL_NODE_IDS);
});

test('test_command_click_selects_the_block_and_does_not_filter', async () => {
    await turnToggleOn();
    await executeExpression('selectEditorNode(null)');
    await clickNodeWithMouse('B_YES', Modifier.Meta);
    // await waitMilliseconds(600);
    assert.deepEqual(await readJson('pathView.clickedIds'), []);
    await assertShown(ALL_NODE_IDS);
    assert.equal(await executeExpression("document.querySelectorAll('#diagram .editor-selected').length"), 1);
});

test('test_downstream_view_stays_on_until_back_restores_a_step_that_names_a_removed_block', async () => {
    await turnToggleOn();
    await clickFilter('Q_ASK');
    await clickFilter('B_NO');
    // A route click: only the Back history names B_NO now.
    await clickFilter('Q_ASK');
    await selectBlock('B_NO');
    await runInspectorAction('remove');
    assert.equal(await readTogglePressed(), 'true');
    assert.equal(await readErrorLog(), '');
    await clickButtonWithMouse('#backDownstreamViewBtn');
    await assertViewIsOff();
});
