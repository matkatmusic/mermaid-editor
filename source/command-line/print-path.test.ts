import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEditorGraph } from '../model/editor-graph-parse.ts';

const cli = join(import.meta.dirname, 'print-path.ts');

// Path 0x00 takes Yes; path 0x01 takes No.
const SOURCE = [
    'flowchart LR',
    '  %% ==props==: {"blockId":"B_START","note":"kept note"}',
    '  B_START["Start"]',
    '  Q_ASK{{"Ask?"}}',
    '  Q_CHOICE_ASK_YES["Yes"]',
    '  Q_CHOICE_ASK_NO["No"]',
    '  B_YES["Yes block"]',
    '  B_NO["No block"]',
    '  B_END["End"]',
    '  B_START --> Q_ASK',
    '  Q_ASK --> Q_CHOICE_ASK_YES',
    '  Q_ASK --> Q_CHOICE_ASK_NO',
    '  Q_CHOICE_ASK_YES --> B_YES',
    '  Q_CHOICE_ASK_NO --> B_NO',
    '  B_YES --> B_END',
    '  B_NO --> B_END',
].join('\n');

const ALL_IDS = ['B_END', 'B_NO', 'B_START', 'B_YES', 'Q_ASK', 'Q_CHOICE_ASK_NO', 'Q_CHOICE_ASK_YES'];

function runCli(options: string[], source: string = SOURCE) {
    // The folder name has a space, as a real diagram path can.
    const file = join(mkdtempSync(join(tmpdir(), 'print path ')), 'test.mmd');
    writeFileSync(file, source);
    return spawnSync('bun', [cli, file, ...options], { encoding: 'utf8' });
}

function listPrintedIds(options: string[]) {
    const result = runCli(options);
    assert.equal(result.status, 0, result.stderr);
    const { graph, problems } = parseEditorGraph(result.stdout);
    assert.deepEqual(problems, []);
    return [...graph.nodes.keys()].sort();
}

function assertFails(options: string[], message: RegExp, source: string = SOURCE) {
    const result = runCli(options, source);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, message);
}

test('test_print_path_ends_at_the_choice_of_the_last_decision', () => {
    assert.deepEqual(listPrintedIds(['--path', '0x01']), ['B_START', 'Q_ASK', 'Q_CHOICE_ASK_NO']);
});

test('test_print_path_ends_at_the_block_named_by_to', () => {
    assert.deepEqual(listPrintedIds(['--path', '0x01', '--to', 'B_NO']), ['B_NO', 'B_START', 'Q_ASK', 'Q_CHOICE_ASK_NO']);
});

test('test_print_path_include_after_prints_every_block_after_the_route', () => {
    assert.deepEqual(listPrintedIds(['--path', '0x01', '--includeAfter']), ['B_END', 'B_NO', 'B_START', 'Q_ASK', 'Q_CHOICE_ASK_NO']);
});

test('test_print_path_include_after_a_decision_prints_every_branch', () => {
    assert.deepEqual(listPrintedIds(['--path', '0x00', '--to', 'Q_ASK', '--includeAfter']), ALL_IDS);
});

test('test_print_path_keeps_the_direction_and_the_props_line', () => {
    const result = runCli(['--path', '0x00']);
    assert.ok(result.stdout.startsWith('flowchart LR\n'), result.stdout + result.stderr);
    assert.ok(result.stdout.includes('"note":"kept note"'), result.stdout);
});

test('test_print_path_refuses_a_path_number_without_0x', () => {
    assertFails(['--path', '01'], /Bad path number "01"/);
});

test('test_print_path_refuses_a_path_number_with_the_wrong_count_of_digits', () => {
    assertFails(['--path', '0x001'], /write 0x and 2 hex digits/);
});

test('test_print_path_refuses_a_digit_with_no_choice', () => {
    assertFails(['--path', '0x02'], /digit 2 is 2, and the largest is 1/);
});

test('test_print_path_refuses_an_unknown_block', () => {
    assertFails(['--path', '0x00', '--to', 'B_MISSING'], /Unknown block B_MISSING/);
});

test('test_print_path_refuses_a_block_that_is_not_on_the_path', () => {
    assertFails(['--path', '0x01', '--to', 'B_YES'], /Block B_YES is not on path 0x01/);
});

test('test_print_path_refuses_a_diagram_with_errors', () => {
    assertFails(['--path', '0x00'], /non-compliant prefix/, 'flowchart TD\n  X_Bad["Bad"]');
});

test('test_print_path_without_a_path_number_shows_how_to_use_it', () => {
    assertFails([], /Usage: bun print-path\.ts/);
});
