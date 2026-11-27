import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerBrowserHooks, SERVER_PORT } from './browser-harness.ts';
import { executeExpression, send, waitForRender, waitMilliseconds } from './cdp.ts';
import { dispatchNodeClick, openEditorDrawer, resetEditorFixture, setEditorSource } from './editor-helpers.ts';
import { clickInspectorAction } from './inspector-helpers.ts';
import { KeyName, Modifier, clickNodeWithMouse, pressKey } from './real-input.ts';
import { PATH_VIEW_SOURCE, clickButtonWithMouse, readErrorLog } from './path-view-helpers.ts';

registerBrowserHooks(import.meta.url, openEditorDrawer);

async function loadFullDiagram() {
    await resetEditorFixture();
    // A view stays on until a diagram is loaded, so reset first and then set the source.
    await setEditorSource(PATH_VIEW_SOURCE);
    await waitMilliseconds(500);
}

async function turnViewOn() {
    await loadFullDiagram();
    await clickButtonWithMouse('#onePathViewBtn');
}

async function selectBlock(id: string) {
    await executeExpression(`selectEditorNode('${id}')`);
}

function isActionDisabled(action: string): Promise<boolean> {
    return executeExpression(`document.querySelector('[data-action="${action}"]').disabled`);
}

function readSource(): Promise<string> {
    return executeExpression('codeBox.value');
}

function readNotice(): Promise<string> {
    return executeExpression("document.getElementById('inspectorNotice').hidden ? '' : document.getElementById('inspectorNotice').textContent");
}

function isSourceReadOnly(): Promise<boolean> {
    return executeExpression('codeBox.readOnly');
}

async function dispatchShiftClick(id: string) {
    await executeExpression(`document.querySelector('#diagram [id*="flowchart-${id}-"]').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))`);
    await waitMilliseconds(500);
}

async function rightClickViewport() {
    const point = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const rect = document.getElementById('output').getBoundingClientRect();
        return { x: rect.left + 30, y: rect.top + 30 };
    })())`));
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'right', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'right', clickCount: 1 });
    await waitMilliseconds(200);
}

async function assertDecisionSplicedWithOneChoice(action: string) {
    await turnViewOn();
    await selectBlock('B_YES');
    await clickInspectorAction(action);
    await waitMilliseconds(500);
    const source = await readSource();
    assert.ok(source.includes('B_YES --> Q_NEW_1'), source);
    assert.ok(source.includes('Q_NEW_1 --> Q_CHOICE_NEW_1_Y'), source);
    assert.ok(source.includes('Q_CHOICE_NEW_1_Y --> B_END'), source);
    assert.ok(!source.includes('Q_CHOICE_NEW_1_N'), source);
    assert.ok(!source.includes('B_YES --> B_END'), source);
    assert.equal(await readErrorLog(), '');
}

test('test_remove_button_is_disabled_for_a_decision_in_a_view', async () => {
    await turnViewOn();
    await selectBlock('Q_ASK');
    assert.equal(await isActionDisabled('remove'), true);
});

test('test_turning_the_view_on_disables_the_buttons_of_the_selected_block', async () => {
    await loadFullDiagram();
    await selectBlock('Q_ASK');
    assert.equal(await isActionDisabled('remove'), false);
    await clickButtonWithMouse('#onePathViewBtn');
    assert.equal(await isActionDisabled('remove'), true);
});

test('test_turning_the_view_off_enables_the_buttons_of_the_selected_block', async () => {
    await turnViewOn();
    await selectBlock('Q_ASK');
    await clickButtonWithMouse('#fullDiagramBtn');
    assert.equal(await isActionDisabled('remove'), false);
});

test('test_remove_choices_button_is_disabled_in_a_view', async () => {
    await turnViewOn();
    await selectBlock('Q_ASK');
    assert.equal(await isActionDisabled('remove-choices'), true);
});

test('test_add_choice_button_is_disabled_in_the_one_path_view', async () => {
    await turnViewOn();
    await selectBlock('Q_ASK');
    assert.equal(await isActionDisabled('add-choice'), true);
});

test('test_add_static_after_button_is_disabled_on_a_choice_in_a_view', async () => {
    await turnViewOn();
    await selectBlock('Q_CHOICE_ASK_YES');
    assert.equal(await isActionDisabled('add-static-after'), true);
    assert.equal(await isActionDisabled('insert-static-after'), false);
});

test('test_destination_row_is_hidden_in_a_view', async () => {
    await turnViewOn();
    await selectBlock('B_YES');
    assert.equal(await executeExpression("document.getElementById('destinationRow').hidden"), true);
});

test('test_destination_change_is_refused_in_a_view', async () => {
    await turnViewOn();
    await selectBlock('B_YES');
    const before = await readSource();
    await executeExpression("(() => { const select = document.getElementById('destinationSelect'); select.value = ''; select.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await waitMilliseconds(500);
    assert.equal(await readSource(), before);
    assert.equal(await readNotice(), 'Show the full diagram to make this change.');
});

test('test_delete_key_removes_nothing_when_one_selected_block_is_refused', async () => {
    await turnViewOn();
    await clickNodeWithMouse('B_YES', Modifier.Meta);
    await clickNodeWithMouse('Q_ASK', Modifier.Meta);
    const before = await readSource();
    await pressKey(KeyName.Delete);
    assert.equal(await readSource(), before);
    assert.equal(await readNotice(), 'Show the full diagram to remove a decision.');
});

test('test_insert_decision_after_in_a_view_splices_one_choice_into_the_arrow', async () => {
    await assertDecisionSplicedWithOneChoice('insert-decision-after');
});

test('test_add_decision_after_in_a_view_splices_one_choice_into_the_arrow', async () => {
    await assertDecisionSplicedWithOneChoice('add-decision-after');
});

test('test_insert_decision_after_in_the_full_diagram_keeps_two_choices', async () => {
    await loadFullDiagram();
    await dispatchNodeClick('B_YES');
    await clickInspectorAction('insert-decision-after');
    await waitMilliseconds(500);
    const source = await readSource();
    assert.ok(source.includes('Q_NEW_1 --> Q_CHOICE_NEW_1_Y'), source);
    assert.ok(source.includes('Q_NEW_1 --> Q_CHOICE_NEW_1_N'), source);
});

test('test_source_editor_is_read_only_while_a_view_is_on', async () => {
    await turnViewOn();
    assert.equal(await isSourceReadOnly(), true);
});

test('test_source_editor_accepts_typing_after_the_view_turns_off', async () => {
    await turnViewOn();
    await clickButtonWithMouse('#fullDiagramBtn');
    assert.equal(await isSourceReadOnly(), false);
});

test('test_source_editor_accepts_typing_after_another_diagram_loads', async () => {
    await turnViewOn();
    await resetEditorFixture();
    await waitMilliseconds(500);
    assert.equal(await isSourceReadOnly(), false);
});

test('test_source_editor_accepts_typing_after_a_file_opens', async () => {
    await turnViewOn();
    await executeExpression(`showOpenedFile('/tmp/path-view-rules.mmd', ${JSON.stringify(PATH_VIEW_SOURCE)})`);
    await waitMilliseconds(800);
    assert.equal(await isSourceReadOnly(), false);
});

test('test_source_editor_accepts_typing_after_a_new_diagram', async () => {
    await turnViewOn();
    await executeExpression("document.getElementById('newBtn').click()");
    await waitMilliseconds(1000);
    assert.equal(await isSourceReadOnly(), false);
});

test('test_source_editor_stays_read_only_after_an_export_in_a_view', async () => {
    await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/view-export.mmd`, { method: 'PUT', body: PATH_VIEW_SOURCE });
    await executeExpression("loadDiagram('view-export.mmd')");
    await waitMilliseconds(500);
    await clickButtonWithMouse('#onePathViewBtn');
    await executeExpression("document.getElementById('exportAllPathsBtn').click()");
    await waitMilliseconds(1500);
    assert.equal(await executeExpression("document.getElementById('status').textContent"), 'Wrote 2 paths');
    assert.equal(await isSourceReadOnly(), true);
    await resetEditorFixture();
    await waitForRender();
});

test('test_shift_click_adds_no_arrow_in_a_view', async () => {
    await turnViewOn();
    await selectBlock('B_START');
    const before = await readSource();
    await dispatchShiftClick('B_END');
    assert.equal(await readSource(), before);
});

test('test_refused_edit_shows_a_notice_that_says_why', async () => {
    await turnViewOn();
    await selectBlock('B_START');
    await dispatchShiftClick('B_END');
    assert.equal(await readNotice(), 'Show the full diagram to make this change.');
});

test('test_right_click_opens_no_add_block_menu_in_a_view', async () => {
    await turnViewOn();
    await rightClickViewport();
    assert.equal(await executeExpression("document.getElementById('viewportMenu').hidden"), true);
});

test('test_first_shift_click_selects_nothing_in_a_view', async () => {
    await turnViewOn();
    await executeExpression('selectEditorNode(null)');
    await dispatchShiftClick('B_YES');
    assert.equal(await executeExpression('selectedEditorNodeId'), null);
    assert.equal(await readNotice(), 'Show the full diagram to make this change.');
});
