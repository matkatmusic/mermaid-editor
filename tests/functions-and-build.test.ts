import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerBrowserHooks, SERVER_PORT } from "./browser-harness.ts";
import { evaluate, sleep } from "./cdp.ts";
import { nodeIds, openEditorDrawer, setEditorSource } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test('test_functions_only_toggle_exists_and_is_unchecked_by_default', async () => {
  // Step: the checkbox is in the page and unchecked.
  assert.equal(await evaluate("document.getElementById('functionsOnlyToggle').type"), 'checkbox');
  assert.equal(await evaluate("document.getElementById('functionsOnlyToggle').checked"), false);
  // Step: dom.ts exports it as a typed constant.
  assert.ok(readFileSync(join(process.cwd(), 'dom.ts'), 'utf8').includes("export const functionsOnlyToggle = document.getElementById('functionsOnlyToggle') as HTMLInputElement;"));
  // Step: state.functionsOnly defaults to false.
  assert.equal(await evaluate('state.functionsOnly'), false);
});

test('test_functions_only_toggle_filters_both_views_to_functions_and_restores_on_toggle_off', async () => {
  // Scenario: a code-flow diagram whose B_ nodes carry call-signature labels, wired through a non-function step,
  // is filtered down to only its function nodes with edges rerouted directly between them in both the main and
  // phone views; turning the toggle back off restores the original diagram.
  // Step: build the code-flow diagram inline; B_SETUP is a non-function step between two functions.
  await setEditorSource('flowchart TD\n  B_MAIN["main()"]\n  B_SETUP["prepare data"]\n  B_PARSE["parse()"]\n  B_DONE["cleanup()"]\n  B_MAIN --> B_SETUP\n  B_SETUP --> B_PARSE\n  B_PARSE --> B_DONE');
  const mainNodeIds = () => evaluate("JSON.stringify(Array.from(document.querySelectorAll('#diagram g.node')).map(getNodeId).sort())").then(JSON.parse);
  const mainHasEdge = (fragment: string) => evaluate(`JSON.stringify(Array.from(document.querySelectorAll('#diagram path.flowchart-link')).some(el => el.id.includes(${JSON.stringify(fragment)})))`).then(JSON.parse);
  const phoneNodeOrder = () => evaluate("JSON.stringify(Array.from(document.querySelectorAll('#phoneDiagram [data-node-id]')).map(el => el.dataset.nodeId))").then(JSON.parse);
  // Step: with the toggle off, the main view shows every node, including the non-function step.
  assert.deepEqual(await mainNodeIds(), ['B_DONE', 'B_MAIN', 'B_PARSE', 'B_SETUP']);
  assert.equal(await mainHasEdge('L_B_MAIN_B_SETUP_'), true);
  // Step: enable the functions-only toggle and let both views rerender.
  await evaluate("(() => { const toggle = document.getElementById('functionsOnlyToggle'); toggle.checked = true; toggle.dispatchEvent(new Event('change')); })()");
  await sleep(400);
  assert.equal(await evaluate('state.functionsOnly'), true);
  // Step: the main view now holds only the three function nodes.
  assert.deepEqual(await mainNodeIds(), ['B_DONE', 'B_MAIN', 'B_PARSE']);
  // Step: the phone view holds the same three function nodes.
  assert.deepEqual(await nodeIds(), ['B_DONE', 'B_MAIN', 'B_PARSE']);
  // Step: the non-function step is gone from both views.
  assert.ok(!(await mainNodeIds()).includes('B_SETUP'));
  assert.ok(!(await nodeIds()).includes('B_SETUP'));
  // Step: the edge is rerouted directly from B_MAIN to B_PARSE in both views, skipping the removed step.
  assert.equal(await mainHasEdge('L_B_MAIN_B_PARSE_'), true);
  assert.deepEqual(await phoneNodeOrder(), ['B_MAIN', 'B_PARSE', 'B_DONE']);
  assert.equal(await mainHasEdge('L_B_PARSE_B_DONE_'), true);
  // Step: disable the functions-only toggle and let both views rerender.
  await evaluate("(() => { const toggle = document.getElementById('functionsOnlyToggle'); toggle.checked = false; toggle.dispatchEvent(new Event('change')); })()");
  await sleep(400);
  assert.equal(await evaluate('state.functionsOnly'), false);
  // Step: the original diagram is restored, non-function step and original edge included.
  assert.deepEqual(await mainNodeIds(), ['B_DONE', 'B_MAIN', 'B_PARSE', 'B_SETUP']);
  assert.equal(await mainHasEdge('L_B_MAIN_B_SETUP_'), true);
  // Step: the rerouted function-to-function edge is gone once filtering is off.
  assert.equal(await mainHasEdge('L_B_MAIN_B_PARSE_'), false);
  // Step: restore the accountability diagram so later runs start clean.
  await evaluate("loadDiagram('accountability.mmd')");
  await sleep(300);
});

test('test_all_committed_diagrams_validate_with_mermaid', async () => {
  // Step: every diagram known to the server parses cleanly with Mermaid.
  const names: string[] = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams`).then((r) => r.json());
  for (const name of names) {
    const source = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${encodeURIComponent(name)}`).then((r) => r.text());
    await evaluate(`mermaid.parse(${JSON.stringify(source)})`);
  }
});

test('test_viewer_js_build_matches_committed_bundle', async () => {
  // Step: rebuild viewer.js from viewer.ts into a fresh temp file.
  const outDir = mkdtempSync(join(tmpdir(), 'viewer-build-'));
  const outFile = join(outDir, 'viewer.js');
  spawnSync('bun', ['build', 'viewer.ts', '--outfile', outFile], { stdio: 'inherit' });
  const fresh = readFileSync(outFile, 'utf8');
  const committed = readFileSync(join(process.cwd(), 'viewer.js'), 'utf8');
  // Step: the freshly rebuilt bundle is byte-identical to the committed viewer.js.
  assert.equal(fresh, committed);
});
