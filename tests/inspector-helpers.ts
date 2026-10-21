import { executeExpression } from "./cdp.ts";

export async function inspectorState() {
  // Scenario: read the inspector's visibility, title, and Text value in one round trip.
  const json = await executeExpression(`JSON.stringify({
    hidden: document.getElementById('nodeInspector').hidden,
    title: document.getElementById('nodeInspectorTitle').textContent,
    text: document.getElementById('nodeTextInput').value,
  })`);
  return JSON.parse(json);
}

export async function inspectorPlacement() {
  // Scenario: where the card sits relative to the editor drawer and main content area.
  const json = await executeExpression(`JSON.stringify((() => {
    const card = document.getElementById('nodeInspector').getBoundingClientRect();
    const drawer = document.getElementById('drawer').getBoundingClientRect();
    const main = document.getElementById('main').getBoundingClientRect();
    return {
      atDrawerEdge: Math.abs(card.left - drawer.right) <= 1,
      atContentTop: Math.abs(card.top - main.top) <= 1,
      left: card.left,
      top: card.top,
      drawerRight: drawer.right,
      mainTop: main.top,
      width: card.width,
    };
  })())`);
  return JSON.parse(json);
}

export async function destinationState() {
  return executeExpression(`JSON.stringify((() => {
    const row = document.getElementById('destinationRow');
    const select = document.getElementById('destinationSelect');
    return { hidden: row.hidden, value: select.value, dismiss: document.getElementById('nodeInspectorDismissBtn').textContent, options: Array.from(select.options).map(option => ({ value: option.value, text: option.textContent })) };
  })())`).then(JSON.parse);
}

export async function chooseDestination(value: string) {
  await executeExpression(`(() => { const select = document.getElementById('destinationSelect'); select.value = ${JSON.stringify('PLACEHOLDER')}; select.dispatchEvent(new Event('change', { bubbles: true })); })()`.replace(JSON.stringify('PLACEHOLDER'), JSON.stringify(value)));
  await executeExpression('window.editorActionPromise');
}

export async function clickInspectorAction(action: string) {
  await executeExpression(`document.querySelector('[data-action="${action}"]').click()`);
  await executeExpression('window.editorActionPromise');
}

export async function inspectorActions() {
  return executeExpression(`JSON.stringify(Array.from(document.querySelectorAll('#nodeInspectorActions button')).map(button => ({ action: button.dataset.action, text: button.textContent, spanTwoColumns: button.classList.contains('span-2') })))`).then(JSON.parse);
}

export async function inspectorFocus() {
  return executeExpression(`JSON.stringify({ activeId: document.activeElement?.id, selectedId: document.getElementById('selectedNode').textContent })`).then(JSON.parse);
}

export async function destinationRender() {
  // Reads the destination row's rendered display, label text, and option count.
  return executeExpression(`JSON.stringify((() => {
    const row = document.getElementById('destinationRow');
    const select = document.getElementById('destinationSelect');
    return { display: getComputedStyle(row).display, labelText: row.querySelector('span').textContent, optionCount: select.options.length };
  })())`).then(JSON.parse);
}
