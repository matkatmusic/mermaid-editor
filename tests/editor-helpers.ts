import assert from "node:assert/strict";
import { evaluate, sleep } from "./cdp.ts";
import { SERVER_PORT } from "./browser-harness.ts";
import { EDITOR_FIXTURE_NAME, editorFixtureSource } from "./fixtures.ts";

export async function openEditorDrawer() {
  // Step: open the drawer if it is closed, so the editor is interactable.
  const drawerClosed = await evaluate("document.getElementById('drawer').classList.contains('closed')");
  if (drawerClosed) {
    await evaluate("document.getElementById('drawerToggle').click()");
  }
}

export async function nodeIds() {
  const json = await evaluate(
    "JSON.stringify(Array.from(document.querySelectorAll('#phoneDiagram [data-node-id]')).map(el => el.dataset.nodeId).sort())"
  );
  return JSON.parse(json);
}

export async function resetEditorFixture() {
  // Scenario: put the editor fixture back to its original bytes and load it fresh in web view.
  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`, {
    method: "PUT",
    body: editorFixtureSource,
  });
  await evaluate(
    `loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`
  );
  await sleep(300);
}

export async function selectEditorNode(id: string | null) {
  await evaluate(`window.selectEditorNode(${JSON.stringify(id)})`);
}

export async function runEditorAction(name: string) {
  await evaluate(`window.${name}(); window.editorActionPromise`);
}

export async function assertEditorSourceIsSavedAndValid() {
  // Scenario: the in-memory source, the file on disk, and the reloaded textarea all agree, and Mermaid accepts it.
  const source = await evaluate("codeBox.value");
  const saved = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`).then((r) => r.text());
  assert.equal(saved, source);
  await evaluate(`mermaid.parse(${JSON.stringify(source)})`);
  await evaluate(`loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`);
  await sleep(300);
  const reloaded = await evaluate("codeBox.value");
  assert.equal(reloaded, source);
}

export async function clickNode(id: string) {
  await evaluate(`document.querySelector('[id*="flowchart-${id}-"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
}

export async function dblclickNode(id: string) {
  await evaluate(`document.querySelector('[id*="flowchart-${id}-"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
}

export async function setEditorSource(source: string) {
  await evaluate(`codeBox.value = ${JSON.stringify('PLACEHOLDER')}; codeBox.dispatchEvent(new Event('input'))`.replace(JSON.stringify('PLACEHOLDER'), JSON.stringify(source)));
  await sleep(300);
}

export async function outputScrollTop() {
  return evaluate("document.getElementById('output').scrollTop");
}
