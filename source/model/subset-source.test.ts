import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEditorGraph } from './editor-graph-parse.ts';
// import { buildSubsetSource } from './subset-source.ts';
import { buildPathSource, buildSubsetSource } from './subset-source.ts';
import type { Edge } from '../../dom.ts';

const SOURCE = [
    'flowchart LR',
    '  classDef warm fill:#f00,stroke:#000',
    '  classDef cold fill:#00f,stroke:#000',
    '  %% ==props==: {"blockId":"B_START","alignment":"left","justification":"right","width":240,"height":80,"note":"first"}',
    '  B_START["Start"]',
    '  Q_ASK{{"Ask?"}}',
    '  Q_OTHER{"Other?"}',
    '  Q_CHOICE_YES["Yes"]',
    '  %% ==props==: {"blockId":"B_HIDDEN","note":"hidden"}',
    '  B_HIDDEN["Hidden"]',
    '  B_START --> Q_ASK',
    '  Q_ASK -- "agreed" --> Q_CHOICE_YES',
    '  Q_CHOICE_YES --> B_HIDDEN',
    '  Q_CHOICE_YES --> Q_ASK',
    '  class B_START warm',
    '  class B_HIDDEN cold',
].join('\n');

const SHOWN_IDS = ['B_START', 'Q_ASK', 'Q_CHOICE_YES'];
// The last arrow closes a loop back to Q_ASK.
const SHOWN_EDGES: Edge[] = [['B_START', 'Q_ASK'], ['Q_ASK', 'Q_CHOICE_YES'], ['Q_CHOICE_YES', 'Q_ASK']];

function buildShownSubset() {
    return buildSubsetSource(parseEditorGraph(SOURCE).graph, SHOWN_IDS, SHOWN_EDGES);
}

test('test_subset_source_declares_only_the_shown_blocks', () => {
    const { graph } = parseEditorGraph(buildShownSubset());
    assert.deepEqual([...graph.nodes.keys()], SHOWN_IDS);
});

test('test_subset_source_keeps_the_full_props_line_of_a_shown_block', () => {
    assert.ok(buildShownSubset().includes('  %% ==props==: {"blockId":"B_START","alignment":"left","justification":"right","width":240,"height":80,"note":"first"}'));
});

test('test_subset_source_drops_the_props_line_of_a_hidden_block', () => {
    assert.ok(!buildShownSubset().includes('B_HIDDEN'));
});

test('test_subset_source_writes_only_the_shown_arrows', () => {
    // Round trip: the subset parses with no problem, and holds each shown arrow of the loop once.
    const { graph, problems } = parseEditorGraph(buildShownSubset());
    assert.deepEqual(problems, []);
    assert.deepEqual(graph.edges.map((edge) => [edge.from, edge.to]), SHOWN_EDGES);
});

test('test_subset_source_keeps_the_label_of_a_shown_arrow', () => {
    const { graph } = parseEditorGraph(buildShownSubset());
    assert.deepEqual(graph.edges.map((edge) => edge.label), [undefined, 'agreed', undefined]);
});

test('test_subset_source_keeps_the_class_definition_and_class_line_of_shown_blocks_only', () => {
    const subset = buildShownSubset();
    assert.ok(subset.includes('  classDef warm fill:#f00,stroke:#000\n  class B_START warm'));
    assert.ok(!subset.includes('cold'));
});

test('test_subset_source_keeps_the_hexagon_or_diamond_shape_of_a_decision', () => {
    const subset = buildSubsetSource(parseEditorGraph(SOURCE).graph, ['Q_ASK', 'Q_OTHER'], []);
    assert.ok(subset.includes('  Q_ASK{{"Ask?"}}'));
    assert.ok(subset.includes('  Q_OTHER{"Other?"}'));
});

test('test_subset_source_keeps_the_flowchart_direction_line', () => {
    assert.equal(buildShownSubset().split('\n')[0], 'flowchart LR');
});

test('test_path_source_declares_each_block_once_and_each_arrow_once', () => {
    // The path goes round the loop back to Q_ASK.
    const pathSource = buildPathSource(parseEditorGraph(SOURCE).graph, ['B_START', 'Q_ASK', 'Q_CHOICE_YES', 'Q_ASK']);
    assert.equal(pathSource, buildShownSubset());
});
