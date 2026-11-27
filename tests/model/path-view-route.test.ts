import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerBrowserHooks } from '../browser-harness.ts';
import { executeExpression, waitMilliseconds } from '../cdp.ts';
import { openEditorDrawer } from '../editor-helpers.ts';
import { clickNodeWithMouse } from '../real-input.ts';
import { loadPathViewSource } from '../path-view-helpers.ts';
import { parseEditorGraph } from '../../source/model/editor-graph-parse.ts';

registerBrowserHooks(import.meta.url, openEditorDrawer);

// The No choice reaches B_END through one more block than the Yes choice. B_LOOP_A and B_LOOP_B have no start block.
const ROUTE_SOURCE = [
    'flowchart TD',
    '  B_START["Start"]',
    '  Q_ASK{{"Ask?"}}',
    '  Q_CHOICE_ASK_NO["No"]',
    '  Q_CHOICE_ASK_YES["Yes"]',
    '  B_LONG["Long way"]',
    '  B_END["End"]',
    '  B_LOOP_A["Loop A"]',
    '  B_LOOP_B["Loop B"]',
    '  B_START --> Q_ASK',
    '  Q_ASK --> Q_CHOICE_ASK_NO',
    '  Q_ASK --> Q_CHOICE_ASK_YES',
    '  Q_CHOICE_ASK_NO --> B_LONG',
    '  B_LONG --> B_END',
    '  Q_CHOICE_ASK_YES --> B_END',
    '  B_LOOP_A --> B_LOOP_B',
    '  B_LOOP_B --> B_LOOP_A',
].join('\n');

// Q_ASK leads straight to the decision Q_NEXT.
const DECISION_CHAIN_SOURCE = [
    'flowchart TD',
    '  Q_ASK{{"Ask?"}}',
    '  Q_NEXT{{"Next?"}}',
    '  Q_CHOICE_NEXT_YES["Yes"]',
    '  B_END["End"]',
    '  Q_ASK --> Q_NEXT',
    '  Q_NEXT --> Q_CHOICE_NEXT_YES',
    '  Q_CHOICE_NEXT_YES --> B_END',
].join('\n');

function buildRouteCall(nodeId: string, source: string = ROUTE_SOURCE) {
    const { graph } = parseEditorGraph(source);
    const edges = graph.edges.map((edge) => [edge.from, edge.to]);
    const nodes = [...graph.nodes];
    return `findRouteIdsToNode(${JSON.stringify(nodeId)}, ${JSON.stringify(edges)}, { nodes: new Map(${JSON.stringify(nodes)}) })`;
}

async function findRouteIds(nodeId: string): Promise<string[]> {
    // return executeExpression(`JSON.stringify(${buildRouteCall(nodeId)})`).then(JSON.parse);
    return executeExpression<string>(`JSON.stringify(${buildRouteCall(nodeId)})`).then(JSON.parse);
}

async function listPhoneNodeIds(): Promise<string[]> {
    // return executeExpression("JSON.stringify([...document.querySelectorAll('#phoneDiagram [data-node-id]')].map(el => el.dataset.nodeId))").then(JSON.parse);
    return executeExpression<string>("JSON.stringify([...document.querySelectorAll('#phoneDiagram [data-node-id]')].map(el => el.dataset.nodeId))").then(JSON.parse);
}

test('test_route_to_a_block_lists_the_blocks_decisions_and_choices_in_order', async () => {
    await loadPathViewSource(ROUTE_SOURCE);
    assert.deepEqual(await findRouteIds('B_LONG'), ['B_START', 'Q_ASK', 'Q_CHOICE_ASK_NO', 'B_LONG']);
});

test('test_route_to_a_block_is_the_shortest_of_two_routes', async () => {
    await loadPathViewSource(ROUTE_SOURCE);
    assert.deepEqual(await findRouteIds('B_END'), ['B_START', 'Q_ASK', 'Q_CHOICE_ASK_YES', 'B_END']);
});

test('test_route_to_a_choice_ends_at_that_choice', async () => {
    await loadPathViewSource(ROUTE_SOURCE);
    assert.deepEqual(await findRouteIds('Q_CHOICE_ASK_YES'), ['B_START', 'Q_ASK', 'Q_CHOICE_ASK_YES']);
});

test('test_route_through_a_decision_that_leads_to_a_decision_lists_each_id_once', async () => {
    await loadPathViewSource(DECISION_CHAIN_SOURCE);
    // const routeIds = await executeExpression(`JSON.stringify(${buildRouteCall('B_END', DECISION_CHAIN_SOURCE)})`).then(JSON.parse);
    // const routeIds = await executeExpression<string>(`JSON.stringify(${buildRouteCall('B_END', DECISION_CHAIN_SOURCE)})`).then(JSON.parse);
    const routeIds = await executeExpression<string>(`JSON.stringify(${buildRouteCall('B_END', DECISION_CHAIN_SOURCE)})`).then((json) => JSON.parse(json) as string[]);
    assert.deepEqual(routeIds, ['Q_ASK', 'Q_NEXT', 'Q_CHOICE_NEXT_YES', 'B_END']);
});

test('test_route_search_leaves_the_phone_answers_unchanged', async () => {
    // Click B_LONG so the phone holds an answer, then search a route through the other choice and draw again.
    await loadPathViewSource(ROUTE_SOURCE);
    await clickNodeWithMouse('B_LONG');
    await waitMilliseconds(500);
    const idsBefore = await listPhoneNodeIds();
    await findRouteIds('Q_CHOICE_ASK_YES');
    await executeExpression('render()');
    await waitMilliseconds(500);
    assert.deepEqual(await listPhoneNodeIds(), idsBefore);
});

test('test_route_to_a_block_that_no_start_block_reaches_throws', async () => {
    await loadPathViewSource(ROUTE_SOURCE);
    // The page returns the error text, because executeExpression does not throw for a page error.
    // const message = await executeExpression(`(() => { try { ${buildRouteCall('B_LOOP_A')}; return 'no error'; } catch (error) { return error.message; } })()`);
    const message = await executeExpression<string>(`(() => { try { ${buildRouteCall('B_LOOP_A')}; return 'no error'; } catch (error) { return error.message; } })()`);
    assert.match(message, /B_LOOP_A/);
});
