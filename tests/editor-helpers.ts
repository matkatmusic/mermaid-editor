import assert from "node:assert/strict";
import { executeExpression } from "./cdp.ts";
import { SERVER_PORT } from "./browser-harness.ts";
import { EDITOR_FIXTURE_NAME, editorFixtureSource } from "./fixtures.ts";

export async function openEditorDrawer() {
  // Step: open the drawer if it is closed, so the editor is interactable.
  const drawerClosed = await executeExpression("document.getElementById('drawer').classList.contains('closed')");
  if (drawerClosed) {
    await executeExpression("document.getElementById('drawerToggle').click()");
  }
}

export async function getNodeIds() {
  // const json = await executeExpression(
  const json = await executeExpression<string>(
    "JSON.stringify(Array.from(document.querySelectorAll('#phoneDiagram [data-node-id]')).map(el => el.dataset.nodeId).sort())"
  );
  // return JSON.parse(json);
  return JSON.parse(json) as string[];
}

export async function resetEditorFixture() {
  // Scenario: put the editor fixture back to its original bytes and load it fresh in web view.
  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`, {
    method: "PUT",
    body: editorFixtureSource,
  });
  await executeExpression(
    `loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`
  );
}

export async function selectEditorNode(id: string | null) {
  await executeExpression(`window.selectEditorNode(${JSON.stringify(id)})`);
}

export async function executeEditorAction(name: string) {
  await executeExpression(`window.${name}(); window.editorActionPromise`);
}

export async function assertEditorSourceIsSavedAndValid() {
  // Scenario: the in-memory source, the file on disk, and the reloaded textarea all agree, and Mermaid accepts it.
  const source = await executeExpression("codeBox.value");
  const savedResponse = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`);
  const saved = await savedResponse.text();
  assert.equal(saved, source);
  await executeExpression(`mermaid.parse(${JSON.stringify(source)})`);
  await executeExpression(`loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`);
  const reloaded = await executeExpression("codeBox.value");
  assert.equal(reloaded, source);
}

export async function dispatchNodeClick(id: string) {
  await executeExpression(`document.querySelector('[id*="flowchart-${id}-"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
}

export async function dispatchNodeDblclick(id: string) {
  // The double click is on the middle of the label text: a double click outside the text gives the block its automatic size (task 108).
  await executeExpression(`(() => {
    const node = document.querySelector('[id*="flowchart-${id}-"]');
    const textBox = node.querySelector('.nodeLabel').getBoundingClientRect();
    node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: (textBox.left + textBox.right) / 2, clientY: (textBox.top + textBox.bottom) / 2 }));
  })()`);
}

export async function setEditorSource(source: string) {
  await executeExpression(`codeBox.value = ${JSON.stringify(source)}; codeBox.dispatchEvent(new Event('input')); render()`);
}

export async function getOutputScrollTop() {
  return executeExpression("document.getElementById('output').scrollTop");
}

// export async function measureSourceLineBounds(lineIndex: number) {
export async function measureSourceLineBounds(lineIndex: number): Promise<{ top: number; bottom: number; lineHeight: number }> {
  // Measure one soft-wrapped source line with a hidden copy of the textarea text.
  // return executeExpression(`JSON.stringify((() => {
  return executeExpression<string>(`JSON.stringify((() => {
    const style = getComputedStyle(codeBox);
    const mirror = document.createElement('div');
    for (const name of ['fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'tabSize', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth', 'boxSizing'])
      mirror.style[name] = style[name];
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.width = codeBox.clientWidth + 'px';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.overflowWrap = 'break-word';
    const lines = codeBox.value.split('\\n');
    mirror.textContent = lines.slice(0, ${lineIndex}).map((line) => line + '\\n').join('');
    const marker = document.createElement('span');
    marker.textContent = lines[${lineIndex}] || '.';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const top = marker.offsetTop;
    const bottom = top + marker.offsetHeight;
    mirror.remove();
    return { top, bottom, lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 };
  })())`).then(JSON.parse);
}

export async function findNodeLineIndex(id: string) {
  // The declaration line is the first line that starts with the id followed by [, { or (.
  // return executeExpression(`codeBox.value.split('\\n').findIndex((line) => { const trimmed = line.trim(); return trimmed.startsWith(${JSON.stringify(id)}) && '[{('.includes(trimmed.charAt(${id.length})); })`);
  return executeExpression<number>(`codeBox.value.split('\\n').findIndex((line) => { const trimmed = line.trim(); return trimmed.startsWith(${JSON.stringify(id)}) && '[{('.includes(trimmed.charAt(${id.length})); })`);
}
