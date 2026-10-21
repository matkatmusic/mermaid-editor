import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { SEARCH_FIXTURE } from "./fixtures.ts";
import { resetEditorFixture, selectEditorNode, setEditorSource } from "./editor-helpers.ts";

export async function typeSearch(query: string) {
  // Scenario: put text in the search field and fire the input event that one keypress fires.
  await executeExpression(`(() => { const input = document.getElementById('searchInput'); input.value = ${JSON.stringify(query)}; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await waitMilliseconds(300);
}

export async function searchState() {
  // Scenario: read the selection, the inspector, and every search control in one round trip.
  const json = await executeExpression(`JSON.stringify({
    selected: document.getElementById('selectedNode').textContent,
    inspectorHidden: document.getElementById('nodeInspector').hidden,
    value: document.getElementById('searchInput').value,
    clearHidden: document.getElementById('searchClearBtn').hidden,
    previousHidden: document.getElementById('searchPreviousBtn').hidden,
    nextHidden: document.getElementById('searchNextBtn').hidden,
    counter: document.getElementById('searchCounter').textContent,
    counterHidden: document.getElementById('searchCounter').hidden,
  })`);
  return JSON.parse(json);
}

export async function startSearchTest() {
  // Scenario: load the search fixture, drop any selection, and empty the search field.
  await resetEditorFixture();
  await setEditorSource(SEARCH_FIXTURE);
  await selectEditorNode(null);
  await typeSearch('');
}

export async function nodeIsInMainView(id: string) {
  return executeExpression(`(() => {
    const pane = document.getElementById('output').getBoundingClientRect();
    const node = document.querySelector('#diagram [id*="flowchart-${id}-"]').getBoundingClientRect();
    const x = node.left + node.width / 2;
    const y = node.top + node.height / 2;
    return x >= pane.left && x <= pane.right && y >= pane.top && y <= pane.bottom;
  })()`);
}
