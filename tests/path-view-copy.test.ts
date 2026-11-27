import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerBrowserHooks } from './browser-harness.ts';
import { executeExpression, waitMilliseconds } from './cdp.ts';
import { openEditorDrawer, resetEditorFixture } from './editor-helpers.ts';
import { clickNodeWithMouse } from './real-input.ts';
import { PATH_VIEW_SOURCE, clickButtonWithMouse, readShownNodeIds } from './path-view-helpers.ts';
import { parseEditorGraph } from '../source/model/editor-graph-parse.ts';

registerBrowserHooks(import.meta.url, openEditorDrawer);

const PROJECT_FOLDER = join(import.meta.dirname, '..', '..');
// After B_A the walk must take choice B, so no path number draws the route that then takes Exit.
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

// The command runs the tool on a real file, so each test opens a file that exists; its folder name has a space.
// async function openDiagramFile() {
async function openDiagramFile(source: string = PATH_VIEW_SOURCE) {
    const file = join(mkdtempSync(join(tmpdir(), 'copy command ')), 'diagram.mmd');
    // writeFileSync(file, PATH_VIEW_SOURCE);
    writeFileSync(file, source);
    await resetEditorFixture();
    // await executeExpression(`showOpenedFile(${JSON.stringify(file)}, ${JSON.stringify(PATH_VIEW_SOURCE)})`);
    await executeExpression(`showOpenedFile(${JSON.stringify(file)}, ${JSON.stringify(source)})`);
    await waitMilliseconds(1000);
    // The test reads what the page writes to the clipboard.
    await executeExpression('window.copied = []; navigator.clipboard.writeText = async (text) => { window.copied.push(text); };');
    return file;
}

async function clickFilter(id: string) {
    await clickNodeWithMouse(id);
    await waitMilliseconds(600);
}

function readCopiedTexts(): Promise<string[]> {
    // return executeExpression('JSON.stringify(window.copied)').then(JSON.parse);
    return executeExpression<string>('JSON.stringify(window.copied)').then(JSON.parse);
}

function isDisabled(id: string): Promise<boolean> {
    return executeExpression(`document.getElementById('${id}').disabled`);
}

function countShownBoxes(id: string): Promise<number> {
    return executeExpression(`document.getElementById('${id}').getClientRects().length`);
}

// Runs the copied command in the project folder and lists the block ids it prints.
function listPrintedIds(command: string) {
    const result = spawnSync('sh', ['-c', command], { cwd: PROJECT_FOLDER, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return [...parseEditorGraph(result.stdout).graph.nodes.keys()].sort();
}

test('test_copy_command_buttons_are_hidden_with_no_view', async () => {
    await openDiagramFile();
    assert.equal(await countShownBoxes('copyPathCommandBtn'), 0);
    assert.equal(await countShownBoxes('copyDownstreamCommandBtn'), 0);
});

test('test_one_path_copy_button_copies_the_command_for_the_shown_path', async () => {
    const file = await openDiagramFile();
    await clickButtonWithMouse('#onePathViewBtn');
    await clickButtonWithMouse('#nextViewPathBtn');
    await clickButtonWithMouse('#copyPathCommandBtn');
    assert.deepEqual(await readCopiedTexts(), [`bun mermaid-editor/source/command-line/print-path.ts "${file}" --path 0x01`]);
});

test('test_copied_one_path_command_prints_the_shown_path_to_its_last_choice', async () => {
    await openDiagramFile();
    await clickButtonWithMouse('#onePathViewBtn');
    await clickButtonWithMouse('#nextViewPathBtn');
    await clickButtonWithMouse('#copyPathCommandBtn');
    const [command] = await readCopiedTexts();
    assert.deepEqual(listPrintedIds(command), ['B_START', 'Q_ASK', 'Q_CHOICE_ASK_NO']);
});

test('test_downstream_copy_button_copies_the_command_for_the_clicked_route', async () => {
    const file = await openDiagramFile();
    await clickButtonWithMouse('#downstreamViewBtn');
    await clickFilter('B_NO');
    await clickButtonWithMouse('#copyDownstreamCommandBtn');
    assert.deepEqual(await readCopiedTexts(), [`bun mermaid-editor/source/command-line/print-path.ts "${file}" --path 0x01 --to B_NO --includeAfter`]);
});

test('test_copied_downstream_command_prints_the_blocks_on_screen', async () => {
    await openDiagramFile();
    await clickButtonWithMouse('#downstreamViewBtn');
    await clickFilter('Q_ASK');
    await clickFilter('B_NO');
    const shownIds = await readShownNodeIds();
    await clickButtonWithMouse('#copyDownstreamCommandBtn');
    const [command] = await readCopiedTexts();
    assert.deepEqual(listPrintedIds(command), shownIds);
});

test('test_downstream_copy_button_is_disabled_with_no_filter', async () => {
    await openDiagramFile();
    await clickButtonWithMouse('#downstreamViewBtn');
    assert.equal(await isDisabled('copyDownstreamCommandBtn'), true);
    await clickFilter('B_NO');
    assert.equal(await isDisabled('copyDownstreamCommandBtn'), false);
    await clickButtonWithMouse('#resetDownstreamViewBtn');
    assert.equal(await isDisabled('copyDownstreamCommandBtn'), true);
});

test('test_copy_buttons_are_disabled_for_a_diagram_with_no_file', async () => {
    await openDiagramFile();
    await executeExpression('loadedPath = null');
    await clickButtonWithMouse('#onePathViewBtn');
    assert.equal(await isDisabled('copyPathCommandBtn'), true);
    await clickButtonWithMouse('#fullDiagramBtn');
    await clickButtonWithMouse('#downstreamViewBtn');
    await clickFilter('B_NO');
    assert.equal(await isDisabled('copyDownstreamCommandBtn'), true);
});

test('test_downstream_copy_button_is_disabled_for_a_route_with_no_path_number', async () => {
    await openDiagramFile(LOOP_SOURCE);
    await clickButtonWithMouse('#downstreamViewBtn');
    await clickFilter('B_A');
    assert.equal(await isDisabled('copyDownstreamCommandBtn'), false);
    await clickFilter('B_END');
    assert.equal(await isDisabled('copyDownstreamCommandBtn'), true);
});
