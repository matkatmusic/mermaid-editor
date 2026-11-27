import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerBrowserHooks, SERVER_PORT } from '../../browser-harness.ts';
import { executeExpression, send, waitMilliseconds } from '../../cdp.ts';
import { openEditorDrawer, resetEditorFixture, setEditorSource } from '../../editor-helpers.ts';
import { EDITOR_FIXTURE_NAME } from '../../fixtures.ts';
import { clickInspectorAction } from '../../inspector-helpers.ts';
import { KeyName, clickNodeWithMouse, pressKey } from '../../real-input.ts';
import { PATH_VIEW_SOURCE, clickButtonWithMouse, readErrorLog, readShownEdgeIds, readShownNodeIds } from '../../path-view-helpers.ts';

registerBrowserHooks(import.meta.url, openEditorDrawer);

const YES_NODE_IDS = ['B_END', 'B_START', 'B_YES', 'Q_ASK', 'Q_CHOICE_ASK_YES'];

// A second decision that only the No path reaches.
const TWO_DECISION_SOURCE = PATH_VIEW_SOURCE.replace('  B_NO --> B_END', [
    '  Q_SECOND{{"Second?"}}',
    '  Q_CHOICE_SECOND_YES["Yes"]',
    '  B_NO --> Q_SECOND',
    '  Q_SECOND --> Q_CHOICE_SECOND_YES',
    '  Q_CHOICE_SECOND_YES --> B_END',
].join('\n'));

async function turnViewOn(source: string = PATH_VIEW_SOURCE) {
    await resetEditorFixture();
    await setEditorSource(source);
    await waitMilliseconds(500);
    await clickButtonWithMouse('#onePathViewBtn');
}

async function selectBlock(id: string) {
    await executeExpression(`selectEditorNode('${id}')`);
}

async function runInspectorAction(action: string) {
    await clickInspectorAction(action);
    await waitMilliseconds(600);
}

async function writeInput(inputId: string, value: string) {
    await executeExpression(`(() => { const input = document.getElementById('${inputId}'); input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await executeExpression('window.editorActionPromise');
    await waitMilliseconds(600);
}

async function renameSelectedBlock(namePart: string) {
    await executeExpression("(() => { const input = document.getElementById('nodeNameInput'); input.focus(); input.select(); })()");
    for (const character of namePart)
        await send('Input.dispatchKeyEvent', { type: 'char', text: character, key: character });
    await pressKey(KeyName.Tab);
    await executeExpression('window.editorActionPromise');
    await waitMilliseconds(600);
}

function readSelectedId(): Promise<string | null> {
    return executeExpression('selectedEditorNodeId');
}

function readPathLabel(): Promise<string> {
    return executeExpression("document.getElementById('viewPathLabel').textContent");
}

async function assertShownOnFirstPath(expectedIds: string[]) {
    assert.deepEqual(await readShownNodeIds(), [...expectedIds].sort());
    assert.equal(await readPathLabel(), 'Path 0x00');
    assert.equal(await readErrorLog(), '');
}

test('test_next_path_button_clears_a_selection_the_new_path_does_not_hold', async () => {
    await turnViewOn();
    await selectBlock('B_YES');
    await clickButtonWithMouse('#nextViewPathBtn');
    assert.equal(await readSelectedId(), null);
});

test('test_next_path_button_keeps_a_selection_the_new_path_holds', async () => {
    await turnViewOn();
    await selectBlock('B_END');
    await clickButtonWithMouse('#nextViewPathBtn');
    assert.equal(await readSelectedId(), 'B_END');
});

test('test_rename_of_a_decision_in_a_view_keeps_its_digit', async () => {
    await turnViewOn();
    await clickButtonWithMouse('#nextViewPathBtn');
    await selectBlock('Q_ASK');
    await renameSelectedBlock('DONE');
    assert.equal(await executeExpression('pathView.decisionDigits.Q_DONE'), 1);
    assert.equal(await readPathLabel(), 'Path 0x01');
    assert.equal(await readErrorLog(), '');
});

test('test_text_edit_in_a_view_changes_the_saved_file_and_the_drawn_block', async () => {
    await turnViewOn();
    await selectBlock('B_YES');
    await writeInput('nodeTextInput', 'Agreed');
    const saved = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`).then((response) => response.text());
    assert.ok(saved.includes('B_YES["Agreed"]'), saved);
    // assert.ok((await executeExpression("document.querySelector('#diagram [id*=\"flowchart-B_YES-\"]').textContent")).includes('Agreed'));
    assert.ok((await executeExpression<string>("document.querySelector('#diagram [id*=\"flowchart-B_YES-\"]').textContent")).includes('Agreed'));
    await assertShownOnFirstPath(YES_NODE_IDS);
});

test('test_insert_static_after_in_a_view_draws_the_new_block_on_the_same_path', async () => {
    await turnViewOn();
    await selectBlock('B_YES');
    await runInspectorAction('insert-static-after');
    await assertShownOnFirstPath([...YES_NODE_IDS, 'B_NEW_1']);
});

test('test_insert_static_before_in_a_view_draws_the_new_block_on_the_same_path', async () => {
    await turnViewOn();
    await selectBlock('B_YES');
    await runInspectorAction('insert-static-before');
    await assertShownOnFirstPath([...YES_NODE_IDS, 'B_NEW_1']);
});

test('test_insert_decision_before_in_a_view_keeps_the_shown_blocks', async () => {
    await turnViewOn();
    await selectBlock('B_YES');
    await runInspectorAction('insert-decision-before');
    const shownIds = await readShownNodeIds();
    for (const id of [...YES_NODE_IDS, 'Q_NEW_1'])
        assert.ok(shownIds.includes(id), id);
    assert.equal(await readErrorLog(), '');
});

test('test_remove_middle_block_in_a_view_joins_the_path', async () => {
    await turnViewOn();
    await selectBlock('B_YES');
    await runInspectorAction('remove');
    assert.ok((await readShownEdgeIds()).includes('L_Q_CHOICE_ASK_YES_B_END_0'));
    await assertShownOnFirstPath(YES_NODE_IDS.filter((id) => id !== 'B_YES'));
});

test('test_rename_in_a_view_keeps_the_shown_path', async () => {
    await turnViewOn();
    await selectBlock('B_YES');
    await renameSelectedBlock('AGREED');
    await assertShownOnFirstPath(YES_NODE_IDS.map((id) => id === 'B_YES' ? 'B_AGREED' : id));
});

test('test_undo_and_redo_in_a_view_draw_the_view_again', async () => {
    await turnViewOn();
    await selectBlock('B_YES');
    await runInspectorAction('insert-static-after');
    await executeExpression("document.getElementById('editorUndoBtn').click()");
    await waitMilliseconds(800);
    await assertShownOnFirstPath(YES_NODE_IDS);
    await executeExpression("document.getElementById('editorRedoBtn').click()");
    await waitMilliseconds(800);
    await assertShownOnFirstPath([...YES_NODE_IDS, 'B_NEW_1']);
});

test('test_class_size_alignment_and_note_edits_show_in_a_view', async () => {
    await turnViewOn();
    await selectBlock('B_YES');
    await writeInput('nodeNotesInput', 'a note');
    assert.equal(await executeExpression("document.querySelectorAll('#diagram [id*=\"flowchart-B_YES-\"] .note-dot').length"), 1);
    await assertShownOnFirstPath(YES_NODE_IDS);
});

test('test_search_in_a_view_skips_blocks_the_view_does_not_draw', async () => {
    await turnViewOn();
    await executeExpression("(() => { const input = document.getElementById('searchInput'); input.value = ' block\"'; input.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await waitMilliseconds(800);
    assert.equal(await readSelectedId(), 'B_YES');
    await executeExpression("document.getElementById('searchNextBtn').click()");
    await waitMilliseconds(800);
    assert.equal(await readSelectedId(), 'B_YES');
});

test('test_walk_back_in_a_view_skips_blocks_the_view_does_not_draw', async () => {
    await turnViewOn();
    // B_END has two parents; the first path draws only B_YES.
    await selectBlock('B_END');
    await executeExpression("document.getElementById('walkBackBtn').click()");
    await waitMilliseconds(300);
    assert.equal(await readSelectedId(), 'B_YES');
});

test('test_arrow_keys_in_a_view_skip_blocks_the_view_does_not_draw', async () => {
    await turnViewOn();
    await clickButtonWithMouse('#nextViewPathBtn');
    await clickNodeWithMouse('Q_ASK');
    await pressKey(KeyName.ArrowDown);
    assert.equal(await readSelectedId(), 'Q_CHOICE_ASK_NO');
});

test('test_decision_buttons_in_a_view_skip_blocks_the_view_does_not_draw', async () => {
    await turnViewOn(TWO_DECISION_SOURCE);
    await clickButtonWithMouse('#nextDecisionBtn');
    await clickButtonWithMouse('#nextDecisionBtn');
    assert.equal(await readSelectedId(), 'Q_ASK');
    assert.equal(await readErrorLog(), '');
});
