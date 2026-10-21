import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { EDITOR_FIXTURE_NAME, SCROLL_FIXTURE_NAME, editorFixtureSource } from "./fixtures.ts";
import { dispatchNodeClick, openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickInspectorAction } from "./inspector-helpers.ts";
import { fillClassEditor, openClassPickerNew } from "./class-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test("test_class_picker_creates_and_assigns_a_class_and_recolors_both_views", async () => {
  await resetEditorFixture();
  await dispatchNodeClick("B_Start");
  // Step: open the class picker and create a brand-new class from it, assigning it to B_Start.
  await openClassPickerNew();
  await fillClassEditor('reflection', '#123456', '#000000');
  await executeExpression("document.getElementById('classEditorCreateBtn').click()");
  await executeExpression("window.editorActionPromise");
  await waitMilliseconds(300);
  // Step: both the main SVG and the phone block recolor from the new class's fill.
  const colors = await executeExpression(`JSON.stringify((() => {
    const rect = document.querySelector('#diagram [id*="flowchart-B_Start-"] rect');
    return { regular: getComputedStyle(rect).fill, phone: document.querySelector('#phoneDiagram [data-node-id="B_Start"]').style.background };
  })())`).then(JSON.parse);
  assert.equal(colors.regular, 'rgb(18, 52, 86)');
  assert.equal(colors.phone, 'rgb(18, 52, 86)');
  // Step: the class lives in classDef/class lines, not typeColors/nodeTypes metadata.
  const saved = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`).then((r) => r.text());
  assert.match(saved, /classDef reflection fill:#123456,stroke:#000000/);
  assert.match(saved, /class B_Start reflection/);
  assert.doesNotMatch(saved, /typeColors|nodeTypes/);
  // Step: reloading keeps the class and its color, read fresh from the source.
  await executeExpression(`loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`);
  await waitMilliseconds(300);
  assert.equal(await executeExpression(`document.querySelector('#phoneDiagram [data-node-id="B_Start"]').style.background`), 'rgb(18, 52, 86)');
  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`, { method: 'PUT', body: editorFixtureSource });
});

test("test_class_picker_always_shows_the_nodes_actual_class", async () => {
  // Scenario: this is the bug being fixed - the picker must read the node's real class, not stale state.
  await resetEditorFixture();
  await executeExpression(`loadDiagram(${JSON.stringify(SCROLL_FIXTURE_NAME)})`);
  await waitMilliseconds(500);
  // Step: B_SELF_RESTATE_ISSUE is classed "action" in accountability.mmd's classDef lines.
  await dispatchNodeClick("B_SELF_RESTATE_ISSUE");
  const picker = await executeExpression(`JSON.stringify({
    label: document.getElementById('classPickerLabel').textContent,
    swatch: document.getElementById('classPickerSwatch').style.background,
  })`).then(JSON.parse);
  assert.equal(picker.label, 'action');
  assert.ok(picker.swatch.length > 0);
  // Step: a differently classed node shows its own class, not a stale "forwards".
  await dispatchNodeClick("Q_THEM_DONE_SPEAKING");
  const decisionLabel = await executeExpression("document.getElementById('classPickerLabel').textContent");
  assert.equal(decisionLabel, 'decision');
});

test("test_assigning_a_class_to_a_newly_inserted_decision_colors_it", async () => {
  // Scenario: this is the bug being fixed - a class assigned to a just-inserted node must render.
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  Q_OLD{"Old decision"}\n  B_START["Start"]\n  B_START --> B_END\n  B_END["End"]\n  classDef decision fill:#fff3b0,stroke:#b8860b\n  class Q_OLD decision');
  await dispatchNodeClick('B_START');
  await clickInspectorAction('insert-decision-after');
  await waitMilliseconds(300);
  assert.equal(await executeExpression("document.getElementById('selectedNode').textContent"), 'Q_NEW_1');
  await executeExpression("document.getElementById('classPickerBtn').click()");
  await executeExpression('document.querySelector(\'#classPickerList [data-class-name="decision"]\').click()');
  await executeExpression('window.editorActionPromise');
  await waitMilliseconds(300);
  const fill = await executeExpression(`getComputedStyle(document.querySelector('#diagram [id*="flowchart-Q_NEW_1-"] path, #diagram [id*="flowchart-Q_NEW_1-"] polygon, #diagram [id*="flowchart-Q_NEW_1-"] rect')).fill`);
  assert.equal(fill, 'rgb(255, 243, 176)');
});

test("test_unclassed_nodes_get_diagonal_stripes_in_both_views", async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_ONE["One"]\n  B_TWO["Two"]\n  B_ONE --> B_TWO\n  classDef greenish fill:#00ff00,stroke:#006600\n  class B_TWO greenish');
  const stripes = await executeExpression(`JSON.stringify((() => {
    const oneRect = document.querySelector('#diagram [id*="flowchart-B_ONE-"] rect');
    const twoRect = document.querySelector('#diagram [id*="flowchart-B_TWO-"] rect');
    return {
      oneFill: getComputedStyle(oneRect).fill,
      twoFill: getComputedStyle(twoRect).fill,
      onePhone: document.querySelector('#phoneDiagram [data-node-id="B_ONE"]').style.background,
      twoPhone: document.querySelector('#phoneDiagram [data-node-id="B_TWO"]').style.background,
    };
  })())`).then(JSON.parse);
  assert.match(stripes.oneFill, /url\(.*unclassed-stripe-pattern.*\)/);
  assert.equal(stripes.twoFill, 'rgb(0, 255, 0)');
  assert.match(stripes.onePhone, /repeating-linear-gradient/);
  assert.match(stripes.twoPhone, /rgb\(0, 255, 0\)/);
  await executeExpression(`loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`);
  await waitMilliseconds(300);
});

test("test_classes_dialog_renames_recolors_and_deletes_a_class", async () => {
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_ONE["One"]\n  classDef mine fill:#ff0000,stroke:#000000\n  class B_ONE mine');
  await executeExpression("document.getElementById('classesMenuBtn').click()");
  await waitMilliseconds(100);
  const initialRow = await executeExpression(`JSON.stringify((() => {
    const row = document.querySelector('.classes-row');
    return { name: row.querySelector('.classes-name').value, fill: row.querySelector('.classes-fill').value };
  })())`).then(JSON.parse);
  assert.deepEqual(initialRow, { name: 'mine', fill: '#ff0000' });
  // Step: renaming the class in the dialog rewrites both the classDef and the class line.
  await executeExpression(`(() => {
    const input = document.querySelector('.classes-row .classes-name');
    input.value = 'renamed';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await executeExpression("window.editorActionPromise");
  await waitMilliseconds(200);
  let source = await executeExpression("codeBox.value");
  assert.match(source, /classDef renamed fill:#ff0000,stroke:#000000/);
  assert.match(source, /class B_ONE renamed/);
  // Step: deleting the class from the dialog comments out its classDef; the node becomes unclassed.
  await executeExpression("document.getElementById('classesMenuBtn').click()");
  await waitMilliseconds(100);
  await executeExpression("document.querySelector('.classes-row .classes-delete').click()");
  await executeExpression("window.editorActionPromise");
  await waitMilliseconds(200);
  source = await executeExpression("codeBox.value");
  assert.match(source, /%% classDef renamed fill:#ff0000,stroke:#000000/);
  // Step: an open modal makes the rest of the page inert, so later tests could not focus anything.
  await executeExpression("document.getElementById('classesCloseBtn').click()");
  await executeExpression(`loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`);
  await waitMilliseconds(300);
});
