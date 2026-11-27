import { executeExpression, waitForRender, waitMilliseconds } from "./cdp.ts";
import { SEARCH_FIXTURE } from "./fixtures.ts";
import { resetEditorFixture, selectEditorNode, setEditorSource } from "./editor-helpers.ts";

export async function typeSearch(query: string) {
  // Scenario: put text in the search field and fire the input event that one keypress fires.
  await executeExpression(`(() => { const input = document.getElementById('searchInput'); input.value = ${JSON.stringify(query)}; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  // A second render started before the keypress's own render ends discards that render's centering.
  await waitMilliseconds(500);
  await waitForRender();
}

export async function searchState() {
  // Scenario: read the selection, the inspector, and every search control in one round trip.
  // const json = await executeExpression(`JSON.stringify({
  const json = await executeExpression<string>(`JSON.stringify({
    selected: document.getElementById('selectedNode').textContent,
    inspectorHidden: document.getElementById('nodeInspector').hidden,
    value: document.getElementById('searchInput').value,
    clearHidden: document.getElementById('searchClearBtn').hidden,
    previousHidden: document.getElementById('searchPreviousBtn').hidden,
    nextHidden: document.getElementById('searchNextBtn').hidden,
    counter: document.getElementById('searchCounter').textContent,
    counterHidden: document.getElementById('searchCounter').hidden,
  })`);
  // return JSON.parse(json);
  return JSON.parse(json) as {
    selected: string;
    inspectorHidden: boolean;
    value: string;
    clearHidden: boolean;
    previousHidden: boolean;
    nextHidden: boolean;
    counter: string;
    counterHidden: boolean;
  };
}

export async function startSearchTest() {
  // Scenario: load the search fixture, drop any selection, and empty the search field.
  await resetEditorFixture();
  await setEditorSource(SEARCH_FIXTURE);
  await selectEditorNode(null);
  await typeSearch('');
}

export async function nodeIsInMainView(id: string) {
  // The pane has empty padding around the diagram, so a node is visible only once the pane has scrolled to it: poll up to 3 seconds.
  let isInView = false;
  for (let attempt = 0; attempt < 30 && !isInView; attempt++) {
    isInView = await executeExpression(`(() => {
      const pane = document.getElementById('output').getBoundingClientRect();
      const node = document.querySelector('#diagram [id*="flowchart-${id}-"]').getBoundingClientRect();
      const x = node.left + node.width / 2;
      const y = node.top + node.height / 2;
      return x >= pane.left && x <= pane.right && y >= pane.top && y <= pane.bottom;
    })()`);
    if (!isInView)
      await waitMilliseconds(100);
  }
  return isInView;
}
