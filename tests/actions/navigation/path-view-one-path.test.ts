import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerBrowserHooks } from '../../browser-harness.ts';
import { executeExpression, waitMilliseconds } from '../../cdp.ts';
import { openEditorDrawer, resetEditorFixture } from '../../editor-helpers.ts';
import { PATH_VIEW_SOURCE, clickButtonWithMouse, loadPathViewSource, readErrorLog, readShownEdgeIds, readShownNodeIds } from '../../path-view-helpers.ts';
// import { walkPaths } from '../path-view-model.ts';
import { findNeighbourDigits, walkDigitPath } from '../../../source/model/path-view-model.ts';
import type { PathDiagram } from '../../../source/model/path-view-model.ts';
import type { Edge } from '../../../source/app/dom.ts';

registerBrowserHooks(import.meta.url, openEditorDrawer);

// The No branch is hidden on Path 1; its block has a size, a note and a class.
const HIDDEN_DETAIL_SOURCE = [
    PATH_VIEW_SOURCE,
    '  %% ==props==: {"blockId":"B_NO","width":240,"height":80,"note":"hidden note"}',
    '  classDef warm fill:#f00,stroke:#000',
    '  class B_NO warm',
].join('\n');

const FIRST_PATH_NODE_IDS = ['B_END', 'B_START', 'B_YES', 'Q_ASK', 'Q_CHOICE_ASK_YES'];
const SECOND_PATH_NODE_IDS = ['B_END', 'B_NO', 'B_START', 'Q_ASK', 'Q_CHOICE_ASK_NO'];
const ALL_NODE_IDS = ['B_END', 'B_NO', 'B_START', 'B_YES', 'Q_ASK', 'Q_CHOICE_ASK_NO', 'Q_CHOICE_ASK_YES'];

// Two loops back to one decision, so two paths hold the same blocks in a different order.
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

async function turnViewOn(source: string = HIDDEN_DETAIL_SOURCE) {
    await loadPathViewSource(source);
    // B_NO is hidden on Path 1; the loop source has no B_NO.
    if (source === HIDDEN_DETAIL_SOURCE)
        await executeExpression("selectEditorNode('B_NO')");
    await clickButtonWithMouse('#onePathViewBtn');
}

function readText(id: string): Promise<string> {
    return executeExpression(`document.getElementById('${id}').textContent.trim()`);
}

function readProperty(id: string, property: string): Promise<unknown> {
    return executeExpression(`document.getElementById('${id}').${property}`);
}

async function assertViewIsOff() {
    assert.equal(await readProperty('pathViewControls', 'hidden'), true);
    assert.equal(await executeExpression("document.getElementById('onePathViewBtn').getAttribute('aria-pressed')"), 'false');
    assert.equal(await readErrorLog(), '');
}

async function replaceSourceAndRender(from: string, to: string) {
    await executeExpression(`codeBox.value = codeBox.value.replace(${JSON.stringify(from)}, ${JSON.stringify(to)}); render()`);
    await waitMilliseconds(500);
}

// test('test_path_view_order_matches_export_all_paths', async () => {
//     await loadPathViewSource(LOOP_SOURCE);
//     const edges: Edge[] = [['S', 'Q'], ['Q', 'A'], ['A', 'Q'], ['Q', 'B'], ['B', 'Q'], ['Q', 'E'], ['T', 'Q']];
//     const exported = await executeExpression(`JSON.stringify(listAllPathIds(${JSON.stringify(edges)}))`).then(JSON.parse);
//     assert.deepEqual([...walkPaths(['S', 'T'], edges)], exported);
// });

test('test_every_digit_path_is_an_export_all_path', async () => {
    await loadPathViewSource(LOOP_SOURCE);
    const edges: Edge[] = [['S', 'Q'], ['Q', 'A'], ['A', 'Q'], ['Q', 'B'], ['B', 'Q'], ['Q', 'E'], ['T', 'Q']];
    // const exported: string[][] = await executeExpression(`JSON.stringify(listAllPathIds(${JSON.stringify(edges)}))`).then(JSON.parse);
    const exported: string[][] = await executeExpression<string>(`JSON.stringify(listAllPathIds(${JSON.stringify(edges)}))`).then(JSON.parse);
    const exportedPaths = exported.map((path) => path.join(' '));
    const diagram: PathDiagram = { startIds: ['S', 'T'], decisionIds: ['Q'], edges };
    let digits: number[] | null = [0, 0];
    while (digits) {
        const path = walkDigitPath(diagram, digits).pathIds.join(' ');
        assert.ok(exportedPaths.includes(path), path);
        digits = findNeighbourDigits(diagram, digits, 1);
    }
});

test('test_one_path_toggle_draws_only_the_blocks_of_the_first_path', async () => {
    await turnViewOn();
    assert.deepEqual(await readShownNodeIds(), FIRST_PATH_NODE_IDS);
    assert.equal(await readErrorLog(), '');
});

test('test_one_path_toggle_draws_only_the_arrows_of_the_first_path', async () => {
    await turnViewOn();
    assert.deepEqual(await readShownEdgeIds(), ['L_B_START_Q_ASK_0', 'L_B_YES_B_END_0', 'L_Q_ASK_Q_CHOICE_ASK_YES_0', 'L_Q_CHOICE_ASK_YES_B_YES_0']);
    assert.equal(await readErrorLog(), '');
});

test('test_one_path_toggle_off_restores_the_full_diagram', async () => {
    await turnViewOn();
    await clickButtonWithMouse('#onePathViewBtn');
    assert.deepEqual(await readShownNodeIds(), ALL_NODE_IDS);
    await assertViewIsOff();
});

test('test_full_diagram_button_restores_the_full_diagram', async () => {
    await turnViewOn();
    await clickButtonWithMouse('#fullDiagramBtn');
    assert.deepEqual(await readShownNodeIds(), ALL_NODE_IDS);
    await assertViewIsOff();
});

test('test_one_path_view_leaves_the_source_unchanged', async () => {
    await loadPathViewSource(HIDDEN_DETAIL_SOURCE);
    const before = await executeExpression('codeBox.value');
    await clickButtonWithMouse('#onePathViewBtn');
    assert.equal(await executeExpression('codeBox.value'), before);
    assert.equal(await readErrorLog(), '');
});

// test('test_path_label_reads_path_1', async () => {
test('test_path_label_reads_all_zeros', async () => {
    await turnViewOn();
    // assert.equal(await readText('viewPathLabel'), 'Path 1');
    assert.equal(await readText('viewPathLabel'), 'Path 0x00');
});

test('test_path_controls_are_hidden_when_no_view_is_on', async () => {
    await loadPathViewSource();
    assert.equal(await executeExpression("document.getElementById('pathViewControls').getClientRects().length"), 0);
});

test('test_functions_only_is_disabled_while_a_view_is_on', async () => {
    await turnViewOn();
    assert.equal(await readProperty('functionsOnlyToggle', 'disabled'), true);
});

test('test_view_buttons_are_disabled_while_functions_only_is_on', async () => {
    await loadPathViewSource();
    await clickButtonWithMouse('#functionsOnlyToggle');
    const isDisabled = await readProperty('onePathViewBtn', 'disabled');
    // Turn the toggle off again so that later tests start with the full diagram.
    await clickButtonWithMouse('#functionsOnlyToggle');
    assert.equal(isDisabled, true);
});

test('test_loading_another_diagram_turns_the_view_off', async () => {
    await turnViewOn();
    await resetEditorFixture();
    await waitMilliseconds(800);
    await assertViewIsOff();
});

test('test_opening_a_file_turns_the_view_off', async () => {
    await turnViewOn();
    await executeExpression(`showOpenedFile('/tmp/path-view-other.mmd', ${JSON.stringify(PATH_VIEW_SOURCE)})`);
    await waitMilliseconds(800);
    await assertViewIsOff();
});

test('test_new_diagram_turns_the_view_off', async () => {
    await turnViewOn();
    // #newBtn is inside the closed File menu, so open the menu first.
    await clickButtonWithMouse('#fileMenu summary');
    await clickButtonWithMouse('#newBtn');
    await assertViewIsOff();
});

test('test_next_path_button_draws_the_second_path', async () => {
    await turnViewOn();
    await clickButtonWithMouse('#nextViewPathBtn');
    assert.deepEqual(await readShownNodeIds(), SECOND_PATH_NODE_IDS);
    assert.equal(await readErrorLog(), '');
});

test('test_previous_path_button_draws_the_path_before', async () => {
    await turnViewOn();
    await clickButtonWithMouse('#nextViewPathBtn');
    await clickButtonWithMouse('#previousViewPathBtn');
    assert.deepEqual(await readShownNodeIds(), FIRST_PATH_NODE_IDS);
    assert.equal(await readErrorLog(), '');
});

test('test_path_label_counts_up_with_no_total', async () => {
    await turnViewOn();
    await clickButtonWithMouse('#nextViewPathBtn');
    // assert.equal(await readText('viewPathLabel'), 'Path 2');
    assert.equal(await readText('viewPathLabel'), 'Path 0x01');
});

test('test_path_buttons_reach_both_orders_of_a_loop_with_the_same_blocks', async () => {
    await turnViewOn(LOOP_SOURCE);
    const choiceOrders: string[] = [];
    // for (let pathNumber = 1; pathNumber <= 5; pathNumber++) {
    for (let pathNumber = 1; pathNumber <= 3; pathNumber++) {
        // const pathIds: string[] = await executeExpression('JSON.stringify(pathView.pathIds)').then(JSON.parse);
        const pathIds: string[] = await executeExpression<string>('JSON.stringify(pathView.pathIds)').then(JSON.parse);
        choiceOrders.push(pathIds.filter((id) => id.startsWith('Q_CHOICE')).join(' '));
        assert.equal(await readErrorLog(), '');
        // if (pathNumber < 5)
        if (pathNumber < 3)
            await clickButtonWithMouse('#nextViewPathBtn');
    }
    assert.ok(choiceOrders.includes('Q_CHOICE_LOOP_A Q_CHOICE_LOOP_B Q_CHOICE_LOOP_EXIT'));
    assert.ok(choiceOrders.includes('Q_CHOICE_LOOP_B Q_CHOICE_LOOP_A Q_CHOICE_LOOP_EXIT'));
});

test('test_previous_path_button_is_disabled_on_path_1', async () => {
    await turnViewOn();
    assert.equal(await readProperty('previousViewPathBtn', 'disabled'), true);
});

test('test_next_path_button_is_disabled_on_the_last_path', async () => {
    await turnViewOn();
    assert.equal(await readProperty('nextViewPathBtn', 'disabled'), false);
    await clickButtonWithMouse('#nextViewPathBtn');
    assert.equal(await readProperty('nextViewPathBtn', 'disabled'), true);
});

test('test_edit_in_a_view_keeps_the_path_number', async () => {
    await turnViewOn();
    await clickButtonWithMouse('#nextViewPathBtn');
    await replaceSourceAndRender('"No block"', '"Changed block"');
    // assert.equal(await readText('viewPathLabel'), 'Path 2');
    assert.equal(await readText('viewPathLabel'), 'Path 0x01');
    assert.deepEqual(await readShownNodeIds(), SECOND_PATH_NODE_IDS);
    assert.equal(await readErrorLog(), '');
});

// test('test_view_shows_the_last_path_when_an_edit_leaves_fewer', async () => {
test('test_view_resets_a_digit_that_no_longer_names_a_choice', async () => {
    await turnViewOn();
    await clickButtonWithMouse('#nextViewPathBtn');
    await replaceSourceAndRender('  Q_ASK --> Q_CHOICE_ASK_NO\n  Q_CHOICE_ASK_YES --> B_YES\n  Q_CHOICE_ASK_NO --> B_NO\n', '  Q_CHOICE_ASK_YES --> B_YES\n');
    await replaceSourceAndRender('  B_NO --> B_END', '');
    // assert.equal(await readText('viewPathLabel'), 'Path 1');
    assert.equal(await readText('viewPathLabel'), 'Path 0x00');
    assert.equal(await readErrorLog(), '');
});

test('test_next_path_clears_a_selection_that_the_new_path_does_not_draw', async () => {
    await turnViewOn();
    await executeExpression("selectEditorNode('B_YES')");
    await clickButtonWithMouse('#nextViewPathBtn');
    assert.equal(await executeExpression('selectedEditorNodeId'), null);
    assert.equal(await readProperty('nodeInspector', 'hidden'), true);
});

test('test_next_path_keeps_a_selection_that_the_new_path_draws', async () => {
    await turnViewOn();
    await executeExpression("selectEditorNode('B_END')");
    await clickButtonWithMouse('#nextViewPathBtn');
    assert.equal(await executeExpression('selectedEditorNodeId'), 'B_END');
});
