import { test } from 'node:test';
import assert from 'node:assert/strict';
// import { buildPathEdges, collectDownstreamEdges, findPathByNumber, findViewEditRefusal, walkPaths } from './path-view-model.ts';
// import type { PathView, ViewEdit } from './path-view-model.ts';
// import { buildPathEdges, collectDownstreamEdges, findNeighbourDigits, findViewEditRefusal, listDigitMaximums, walkDigitPath } from './path-view-model.ts';
import { addFilterClick, buildPathEdges, collectDownstreamEdges, findNeighbourDigits, findShortestRouteIds, findViewEditRefusal, listDigitMaximums, walkDigitPath } from './path-view-model.ts';
import type { PathDiagram, PathView, ViewEdit } from './path-view-model.ts';
import { parseEditorGraph } from './editor-graph-parse.ts';
import type { Edge } from './dom.ts';

test('test_path_edges_list_each_arrow_of_a_looping_path_once', () => {
    // The path goes round the loop A, B twice before it leaves to C.
    assert.deepEqual(buildPathEdges(['A', 'B', 'A', 'B', 'C']), [['A', 'B'], ['B', 'A'], ['B', 'C']]);
});

test('test_downstream_arrows_reach_every_end_after_the_block', () => {
    // The arrow before B is not downstream of B.
    const edges: Edge[] = [['A', 'B'], ['B', 'C'], ['B', 'D'], ['C', 'E']];
    assert.deepEqual(collectDownstreamEdges('B', edges), [['B', 'C'], ['B', 'D'], ['C', 'E']]);
});

test('test_downstream_arrows_stop_on_a_loop', () => {
    const edges: Edge[] = [['A', 'B'], ['B', 'C'], ['C', 'B']];
    assert.deepEqual(collectDownstreamEdges('B', edges), [['B', 'C'], ['C', 'B']]);
});

// S leads to a decision with two answers; T is a second start block.
// const TWO_ANSWERS: Edge[] = [['S', 'Q'], ['Q', 'A'], ['Q', 'B'], ['T', 'B']];

// test('test_walk_paths_lists_each_path_depth_first', () => {
//     assert.deepEqual([...walkPaths(['S', 'T'], TWO_ANSWERS)], [['S', 'Q', 'A'], ['S', 'Q', 'B'], ['T', 'B']]);
// });

// test('test_walk_paths_use_each_arrow_once_in_a_loop', () => {
//     assert.deepEqual([...walkPaths(['S'], [['S', 'A'], ['A', 'B'], ['B', 'A']])], [['S', 'A', 'B', 'A']]);
// });

// test('test_find_path_by_number_returns_that_path_and_says_a_next_one_exists', () => {
//     assert.deepEqual(findPathByNumber(['S', 'T'], TWO_ANSWERS, 2), { pathNumber: 2, pathIds: ['S', 'Q', 'B'], hasNextPath: true });
// });

// test('test_find_path_by_number_says_the_last_path_has_no_next', () => {
//     assert.deepEqual(findPathByNumber(['S', 'T'], TWO_ANSWERS, 3), { pathNumber: 3, pathIds: ['T', 'B'], hasNextPath: false });
// });

// test('test_find_path_by_number_returns_the_last_path_when_there_are_fewer', () => {
//     assert.deepEqual(findPathByNumber(['S', 'T'], TWO_ANSWERS, 9), { pathNumber: 3, pathIds: ['T', 'B'], hasNextPath: false });
// });

// test('test_find_path_by_number_throws_when_no_path_exists', () => {
//     assert.throws(() => findPathByNumber([], [['A', 'B'], ['B', 'A']], 1), /no path/);
// });

const { graph: RULE_GRAPH } = parseEditorGraph([
    'flowchart TD',
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
].join('\n'));

const YES_PATH = ['B_START', 'Q_ASK', 'Q_CHOICE_ASK_YES', 'B_YES', 'B_END'];
// const ONE_PATH_VIEW: PathView = { kind: 'onePath', anchorId: null, pathNumber: 1, pathIds: YES_PATH, shownNodeIds: YES_PATH, protectedIds: YES_PATH };
// const ONE_PATH_VIEW: PathView = { kind: 'onePath', anchorId: null, startDigit: 0, decisionDigits: {}, pathIds: YES_PATH, shownNodeIds: YES_PATH, protectedIds: YES_PATH };
const ONE_PATH_VIEW: PathView = { kind: 'onePath', clickedIds: [], clickHistory: [], startDigit: 0, decisionDigits: {}, pathIds: YES_PATH, shownNodeIds: YES_PATH, protectedIds: YES_PATH };
// const DOWNSTREAM_ALL_VIEW: PathView = { kind: 'downstream', anchorId: 'Q_ASK', pathNumber: null, pathIds: null, shownNodeIds: [], protectedIds: ['B_START', 'Q_ASK'] };
// const DOWNSTREAM_ALL_VIEW: PathView = { kind: 'downstream', anchorId: 'Q_ASK', startDigit: 0, decisionDigits: {}, pathIds: null, shownNodeIds: [], protectedIds: ['B_START', 'Q_ASK'] };
const DOWNSTREAM_VIEW: PathView = { kind: 'downstream', clickedIds: ['Q_ASK'], clickHistory: [[]], startDigit: 0, decisionDigits: {}, pathIds: null, shownNodeIds: [], protectedIds: ['B_START', 'Q_ASK'] };

function findOnePathRefusal(edit: ViewEdit, nodeId: string | null) {
    return findViewEditRefusal(ONE_PATH_VIEW, RULE_GRAPH, edit, nodeId);
}

test('test_removing_a_decision_is_refused_in_a_view', () => {
    assert.equal(findOnePathRefusal('removeNode', 'Q_ASK'), 'Show the full diagram to remove a decision.');
});

test('test_removing_the_last_block_of_the_shown_path_is_refused', () => {
    assert.equal(findOnePathRefusal('removeNode', 'B_END'), 'This is the last block of the path.');
});

// test('test_removing_a_block_with_no_outgoing_arrow_is_refused_on_the_all_step', () => {
//     assert.equal(findViewEditRefusal(DOWNSTREAM_ALL_VIEW, RULE_GRAPH, 'removeNode', 'B_END'), 'This is the last block of the path.');
test('test_removing_a_block_with_no_outgoing_arrow_is_refused_in_the_downstream_view', () => {
    assert.equal(findViewEditRefusal(DOWNSTREAM_VIEW, RULE_GRAPH, 'removeNode', 'B_END'), 'This is the last block of the path.');
});

test('test_removing_a_middle_block_of_the_shown_path_is_allowed', () => {
    assert.equal(findOnePathRefusal('removeNode', 'B_YES'), null);
});

test('test_removing_a_choice_on_the_shown_path_is_refused', () => {
    assert.equal(findOnePathRefusal('removeNode', 'Q_CHOICE_ASK_YES'), 'This choice is on the shown path.');
});

test('test_removing_a_choice_off_the_shown_path_is_allowed', () => {
    assert.equal(findOnePathRefusal('removeNode', 'Q_CHOICE_ASK_NO'), null);
});

test('test_remove_choices_is_refused_in_a_view', () => {
    assert.equal(findOnePathRefusal('removeChoices', 'Q_ASK'), 'Show the full diagram to make this change.');
});

test('test_add_choice_is_refused_in_the_one_path_view', () => {
    assert.equal(findOnePathRefusal('addChoice', 'Q_ASK'), 'Show the full diagram to add a choice.');
});

test('test_add_choice_is_allowed_in_the_downstream_view', () => {
    // assert.equal(findViewEditRefusal(DOWNSTREAM_ALL_VIEW, RULE_GRAPH, 'addChoice', 'Q_ASK'), null);
    assert.equal(findViewEditRefusal(DOWNSTREAM_VIEW, RULE_GRAPH, 'addChoice', 'Q_ASK'), null);
});

test('test_insert_static_after_is_allowed_on_a_choice_on_the_shown_path', () => {
    assert.equal(findOnePathRefusal('insertStaticAfter', 'Q_CHOICE_ASK_YES'), null);
});

test('test_insert_static_after_is_refused_on_a_choice_off_the_shown_path', () => {
    assert.equal(findOnePathRefusal('insertStaticAfter', 'Q_CHOICE_ASK_NO'), 'This choice is not on the shown path.');
});

test('test_add_static_after_is_refused_in_a_view', () => {
    assert.equal(findOnePathRefusal('addStaticAfter', 'Q_CHOICE_ASK_YES'), 'Show the full diagram to make this change.');
});

test('test_every_edit_is_allowed_when_no_view_is_on', () => {
    const edits: ViewEdit[] = ['removeNode', 'removeChoices', 'changeDestination', 'connectNodes', 'addStandaloneBlock', 'addStaticAfter', 'insertStaticAfter', 'addChoice'];
    for (const edit of edits)
        assert.equal(findViewEditRefusal(null, RULE_GRAPH, edit, 'Q_ASK'), null);
});

// Q has two answers that loop back and one that leaves.
const LOOP_DIAGRAM: PathDiagram = { startIds: ['S'], decisionIds: ['Q'], edges: [['S', 'Q'], ['Q', 'A'], ['Q', 'B'], ['Q', 'X'], ['A', 'Q'], ['B', 'Q'], ['X', 'E']] };

// Q2 is reached only by the second answer of Q1.
const NESTED_DIAGRAM: PathDiagram = { startIds: ['S'], decisionIds: ['Q1', 'Q2'], edges: [['S', 'Q1'], ['Q1', 'A'], ['Q1', 'Q2'], ['Q2', 'B'], ['Q2', 'C']] };

// The file declares Q1 before Q2, but the walk from S meets Q2 first.
const REVERSED_DIAGRAM: PathDiagram = { startIds: ['S', 'T'], decisionIds: ['Q1', 'Q2'], edges: [['S', 'Q2'], ['Q2', 'A'], ['Q2', 'Q1'], ['Q1', 'B'], ['Q1', 'Q2'], ['A', 'E'], ['B', 'E'], ['T', 'Q1']] };

test('test_digit_walk_takes_the_choice_each_digit_names', () => {
    assert.deepEqual(walkDigitPath(LOOP_DIAGRAM, [0, 2]).pathIds, ['S', 'Q', 'X', 'E']);
});

test('test_digit_walk_takes_the_first_unused_choice_when_the_named_arrow_is_used', () => {
    assert.deepEqual(walkDigitPath(LOOP_DIAGRAM, [0, 1]).pathIds, ['S', 'Q', 'B', 'Q', 'A', 'Q', 'X', 'E']);
});

test('test_digit_walk_ends_when_no_arrow_is_unused', () => {
    const diagram: PathDiagram = { startIds: ['S'], decisionIds: ['Q'], edges: [['S', 'Q'], ['Q', 'A'], ['A', 'Q']] };
    assert.deepEqual(walkDigitPath(diagram, [0, 0]).pathIds, ['S', 'Q', 'A', 'Q']);
});

test('test_digit_walk_shows_unreached_digits_as_zero', () => {
    assert.deepEqual(walkDigitPath(NESTED_DIAGRAM, [0, 0, 1]), { pathIds: ['S', 'Q1', 'A'], digits: [0, 0, 0] });
});

test('test_digit_walk_starts_at_the_start_block_of_the_leftmost_digit', () => {
    assert.equal(walkDigitPath(REVERSED_DIAGRAM, [1, 0, 0]).pathIds[0], 'T');
});

test('test_digit_maximums_hold_the_start_blocks_then_each_decision', () => {
    assert.deepEqual(listDigitMaximums(REVERSED_DIAGRAM), [1, 1, 1]);
});

test('test_digit_maximums_refuse_more_than_16_choices', () => {
    const edges: Edge[] = [];
    for (let choice = 0; choice < 17; choice++)
        edges.push(['Q', `C${choice}`]);
    assert.throws(() => listDigitMaximums({ startIds: ['Q'], decisionIds: ['Q'], edges }), /16/);
});

test('test_next_digits_count_up_and_skip_numbers_that_draw_the_same_path', () => {
    assert.deepEqual(findNeighbourDigits(NESTED_DIAGRAM, [0, 0, 0], 1), [0, 1, 0]);
});

test('test_next_digits_are_null_on_the_last_path', () => {
    assert.equal(findNeighbourDigits(NESTED_DIAGRAM, [0, 1, 1], 1), null);
});

test('test_previous_digits_go_back_one_path', () => {
    assert.deepEqual(findNeighbourDigits(NESTED_DIAGRAM, [0, 1, 0], -1), [0, 0, 0]);
});

test('test_previous_digits_are_null_on_the_first_path', () => {
    assert.equal(findNeighbourDigits(NESTED_DIAGRAM, [0, 0, 0], -1), null);
});

// Every number of the diagram, walked, with unreached digits as 0, each once, smallest first.
function listAllDrawnNumbers(diagram: PathDiagram) {
    let numbers: number[][] = [[]];
    for (const maximum of listDigitMaximums(diagram)) {
        const longer: number[][] = [];
        for (const number of numbers) {
            for (let digit = 0; digit <= maximum; digit++)
                longer.push([...number, digit]);
        }
        numbers = longer;
    }
    const drawnNumbers = numbers.map((number) => walkDigitPath(diagram, number).digits.join(','));
    return [...new Set(drawnNumbers)].sort();
}

test('test_next_digits_reach_every_path_once_when_the_file_order_differs_from_the_walk_order', () => {
    const reached: string[] = [];
    let digits: number[] | null = [0, 0, 0];
    while (digits) {
        reached.push(digits.join(','));
        digits = findNeighbourDigits(REVERSED_DIAGRAM, digits, 1);
    }
    assert.deepEqual(reached, listAllDrawnNumbers(REVERSED_DIAGRAM));
});

test('test_previous_digits_reach_every_path_once_when_the_file_order_differs_from_the_walk_order', () => {
    const expected = listAllDrawnNumbers(REVERSED_DIAGRAM).reverse();
    const reached: string[] = [];
    let digits: number[] | null = expected[0].split(',').map(Number);
    while (digits) {
        reached.push(digits.join(','));
        digits = findNeighbourDigits(REVERSED_DIAGRAM, digits, -1);
    }
    assert.deepEqual(reached, expected);
});

test('test_every_edit_is_allowed_in_the_downstream_view_with_no_filter', () => {
    const view: PathView = { ...DOWNSTREAM_VIEW, clickedIds: [], clickHistory: [], protectedIds: [] };
    const edits: ViewEdit[] = ['removeNode', 'removeChoices', 'changeDestination', 'connectNodes', 'addStandaloneBlock', 'addStaticAfter', 'insertStaticAfter', 'addChoice'];
    for (const edit of edits)
        assert.equal(findViewEditRefusal(view, RULE_GRAPH, edit, 'Q_ASK'), null);
});

// A reaches E through B in one step less than through C and D.
const TWO_ROUTES: Edge[] = [['A', 'C'], ['C', 'D'], ['D', 'E'], ['A', 'B'], ['B', 'E']];

test('test_shortest_route_goes_from_one_block_to_a_later_block', () => {
    assert.deepEqual(findShortestRouteIds('C', 'E', TWO_ROUTES), ['C', 'D', 'E']);
});

test('test_shortest_route_takes_the_shorter_of_two_routes', () => {
    assert.deepEqual(findShortestRouteIds('A', 'E', TWO_ROUTES), ['A', 'B', 'E']);
});

test('test_shortest_route_with_no_way_to_the_block_throws', () => {
    assert.throws(() => findShortestRouteIds('E', 'A', TWO_ROUTES), /E to A/);
});

test('test_filter_click_off_the_route_is_added_to_the_list', () => {
    assert.deepEqual(addFilterClick(['B'], ['A', 'B'], 'D'), ['B', 'D']);
});

test('test_filter_click_on_the_latest_block_changes_nothing', () => {
    const clickedIds = ['B', 'D'];
    assert.equal(addFilterClick(clickedIds, ['A', 'B', 'C', 'D'], 'D'), clickedIds);
});

test('test_filter_click_on_the_route_drops_the_later_clicks', () => {
    // C was never clicked; the clicks after it are B's later ones.
    assert.deepEqual(addFilterClick(['B', 'D', 'E'], ['A', 'B', 'C', 'D', 'E'], 'C'), ['B', 'C']);
});
