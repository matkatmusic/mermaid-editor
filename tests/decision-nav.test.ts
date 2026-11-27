import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitForRender, waitMilliseconds } from "./cdp.ts";
import { nodeIsInMainView } from "./search-helpers.ts";
import { dispatchNodeClick, openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test('test_decision_navigation_steps_through_every_decision_in_source_order_and_focuses_both_views', async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_START["Start"]\n  Q_FIRST{"First decision"}\n  Q_CHOICE_FIRST_YES["Yes"]\n  Q_CHOICE_FIRST_NO["No"]\n  B_MIDDLE["Middle"]\n  Q_SECOND{"Second decision"}\n  Q_CHOICE_SECOND_YES["Yes"]\n  Q_CHOICE_SECOND_NO["No"]\n  B_START --> Q_FIRST\n  Q_FIRST --> Q_CHOICE_FIRST_YES --> B_MIDDLE --> Q_SECOND\n  Q_FIRST --> Q_CHOICE_FIRST_NO\n  Q_SECOND --> Q_CHOICE_SECOND_YES\n  Q_SECOND --> Q_CHOICE_SECOND_NO');
  // Step: the counter follows standalone brace-shaped decisions in source order.
  const initialCounter = await executeExpression("document.getElementById('decisionCounter').textContent");
  // const initialError = await executeExpression("document.getElementById('error').textContent");
  const initialError = await executeExpression<string>("document.getElementById('error').textContent");
  assert.equal(initialCounter, '1 / 2', initialError);
  assert.equal(await executeExpression("document.getElementById('nextDecisionBtn').nextElementSibling?.id"), 'decisionCounter');
  // Step: navigating sets the current decision and advances the counter.
  await executeExpression("document.getElementById('nextDecisionBtn').click()");
  // A second render started before the click's own render ends discards the click's centering.
  await waitMilliseconds(500);
  await waitForRender();
  assert.equal(await executeExpression("document.getElementById('selectedNode').textContent"), 'Q_SECOND');
  assert.equal(await executeExpression("document.getElementById('decisionCounter').textContent"), '2 / 2');
  assert.equal(await executeExpression("currentBottomQ"), 'Q_SECOND');
  assert.equal(await executeExpression("!!document.querySelector('#phoneDiagram [data-node-id=\"Q_SECOND\"]')"), true);
  for (const id of ['Q_FIRST', 'Q_CHOICE_FIRST_YES', 'Q_CHOICE_FIRST_NO', 'B_MIDDLE', 'Q_CHOICE_SECOND_YES', 'Q_CHOICE_SECOND_NO'])
    assert.equal(await executeExpression(`!!document.querySelector('#phoneDiagram [data-node-id="${id}"]')`), true, id);
  assert.equal(await nodeIsInMainView('Q_SECOND'), true);
  // Step: Next and Previous step through every decision in source order and wrap, ignoring graph neighbors.
  await dispatchNodeClick('B_MIDDLE');
  await executeExpression("document.getElementById('nextDecisionBtn').click()");
  await waitForRender();
  assert.equal(await executeExpression("document.getElementById('selectedNode').textContent"), 'Q_FIRST');
  assert.equal(await executeExpression("document.getElementById('decisionCounter').textContent"), '1 / 2');
  await dispatchNodeClick('Q_CHOICE_SECOND_YES');
  await executeExpression("document.getElementById('previousDecisionBtn').click()");
  await waitForRender();
  assert.equal(await executeExpression("document.getElementById('selectedNode').textContent"), 'Q_SECOND');
  assert.equal(await executeExpression("document.getElementById('decisionCounter').textContent"), '2 / 2');
  await executeExpression("document.getElementById('previousDecisionBtn').click()");
  await waitForRender();
  assert.equal(await executeExpression("document.getElementById('selectedNode').textContent"), 'Q_FIRST');
  assert.equal(await executeExpression("document.getElementById('decisionCounter').textContent"), '1 / 2');
});

  // Old nearest-graph-neighbor assertions:
  // // Step: Next starts at the selected block's closest downstream decision, even if the counter is already there.
  // await dispatchNodeClick('B_MIDDLE');
  // await executeExpression("document.getElementById('nextDecisionBtn').click()");
  // await waitForRender();
  // assert.equal(await executeExpression("document.getElementById('selectedNode').textContent"), 'Q_SECOND');
  // assert.equal(await executeExpression("document.getElementById('decisionCounter').textContent"), '2 / 2');
  // // Step: Previous starts at the selected choice's closest upstream decision,
  // // rather than skipping it because of the older navigation position.
  // await dispatchNodeClick('Q_CHOICE_SECOND_YES');
  // assert.equal(await executeExpression("document.getElementById('decisionCounter').textContent"), '2 / 2');
  // await executeExpression("document.getElementById('previousDecisionBtn').click()");
  // await waitForRender();
  // assert.equal(await executeExpression("document.getElementById('selectedNode').textContent"), 'Q_SECOND');
  // assert.equal(await executeExpression("document.getElementById('decisionCounter').textContent"), '2 / 2');
  // await executeExpression("document.getElementById('previousDecisionBtn').click()");
  // await waitForRender();
  // assert.equal(await executeExpression("document.getElementById('selectedNode').textContent"), 'Q_FIRST');
  // assert.equal(await executeExpression("document.getElementById('decisionCounter').textContent"), '1 / 2');
  // });
