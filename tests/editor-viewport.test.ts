import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { EDITOR_FIXTURE_NAME, SCROLL_FIXTURE_NAME, editorFixtureSource, scrollFixtureSource } from "./fixtures.ts";
import { dispatchNodeClick, openEditorDrawer, getOutputScrollTop, setEditorSource } from "./editor-helpers.ts";
import { inspectorFocus, inspectorPlacement } from "./inspector-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test("test_inspector_keeps_the_diagram_scroll_position", async () => {
  // Scenario: selecting, committing with Enter, and dismissing never move #output's scroll position.
  // await executeExpression(`phoneToggle.checked = false; phoneToggle.dispatchEvent(new Event('change'));`);
  await executeExpression(`loadDiagram(${JSON.stringify(SCROLL_FIXTURE_NAME)})`);
  await waitMilliseconds(500);
  // Step: the accountability diagram overflows #output, so scrolling is real.
  const overflow = await executeExpression("JSON.stringify({sh: document.getElementById('output').scrollHeight, ch: document.getElementById('output').clientHeight})").then(JSON.parse);
  assert.ok(overflow.sh > overflow.ch);
  await executeExpression("document.getElementById('output').scrollTop = 150");
  // Step: selecting a node keeps the scroll position, and the card remains drawer-anchored.
  await dispatchNodeClick("B_RAISE_ISSUE");
  assert.equal(await getOutputScrollTop(), 150);
  assert.equal((await inspectorPlacement()).atDrawerEdge, true);
  // Step: committing the text with Enter rerenders, saves, and keeps the scroll position.
  await executeExpression("(() => { const input = document.getElementById('nodeTextInput'); input.value = 'Other side raises an issue'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()");
  await executeExpression("window.editorActionPromise");
  await waitMilliseconds(300);
  assert.equal(await getOutputScrollTop(), 150);
  // Step: dismissing keeps the scroll position.
  await dispatchNodeClick("B_RAISE_ISSUE");
  await executeExpression("document.getElementById('nodeInspectorDismissBtn').click()");
  assert.equal(await getOutputScrollTop(), 150);
  // Step: put the accountability file back to its original bytes.
  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${SCROLL_FIXTURE_NAME}`, { method: "PUT", body: scrollFixtureSource });
});

test("test_save_persists_and_load_restores_editor_metadata_trailer", async () => {
  // Scenario: saving an editor change records the current selection and output viewport in a Mermaid comment trailer.
  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${SCROLL_FIXTURE_NAME}`, { method: "PUT", body: scrollFixtureSource });
  // await executeExpression(`phoneToggle.checked = false; phoneToggle.dispatchEvent(new Event('change'));`);
  await executeExpression(`loadDiagram(${JSON.stringify(SCROLL_FIXTURE_NAME)})`);
  await waitMilliseconds(500);
  await executeExpression("document.getElementById('output').scrollLeft = 0; document.getElementById('output').scrollTop = 150; window.selectEditorNode('B_RAISE_ISSUE'); window.addBlockAfter(); window.editorActionPromise");

  const saved = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${SCROLL_FIXTURE_NAME}`).then((r) => r.text());
  const trailer = saved.match(/%%%%====\n%% DO NOT MODIFY - AUTOMATICALLY GENERATED DURING EVERY SAVE\n%% (\{[^\n]+\})\n%%%%====$/);
  assert.ok(trailer);
  const savedMetadata = JSON.parse(trailer[1]);
  assert.deepEqual({
    lastSelectedNodeId: savedMetadata.lastSelectedNodeId,
    outputScrollLeft: savedMetadata.outputScrollLeft,
    outputScrollTop: savedMetadata.outputScrollTop,
  }, {
    lastSelectedNodeId: 'B_RAISE_ISSUE', outputScrollLeft: 0, outputScrollTop: 150,
  });
  assert.equal(savedMetadata.typeColors, undefined);
  assert.equal(savedMetadata.nodeTypes, undefined);
  assert.equal((saved.match(/%%%%====/g) ?? []).length, 2);

  // Step: a load restores the selected node and saved viewport, while Mermaid still renders the comment trailer.
  await executeExpression(`document.getElementById('output').scrollTop = 0; loadDiagram(${JSON.stringify(SCROLL_FIXTURE_NAME)})`);
  await waitMilliseconds(500);
  assert.deepEqual(await inspectorFocus(), { activeId: '', selectedId: 'B_RAISE_ISSUE' });
  assert.equal(await getOutputScrollTop(), 150);
  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${SCROLL_FIXTURE_NAME}`, { method: "PUT", body: scrollFixtureSource });
});

test("test_load_uses_the_first_node_position_when_scroll_metadata_is_missing", async () => {
  const wideNodes = Array.from({ length: 10 }, (_, index) => `  B_WIDE_${index + 1}["Wide ${index + 1}"]`);
  const deepNodes = Array.from({ length: 12 }, (_, index) => `  B_DEEP_${index + 1}["Deep ${index + 1}"]`);
  const wideEdges = Array.from({ length: 10 }, (_, index) => `  B_FIRST --> B_WIDE_${index + 1}`);
  const deepEdges = Array.from({ length: 11 }, (_, index) => `  B_DEEP_${index + 1} --> B_DEEP_${index + 2}`);
  const body = [
    'flowchart TD',
    '  B_FIRST["First"]',
    ...wideNodes,
    ...deepNodes,
    ...wideEdges,
    '  B_WIDE_1 --> B_DEEP_1',
    ...deepEdges,
  ].join('\n');
  const sourceWithoutScroll = `${body}\n%%%%====\n%% DO NOT MODIFY - AUTOMATICALLY GENERATED DURING EVERY SAVE\n%% {"lastSelectedNodeId":null}\n%%%%====`;
  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`, { method: 'PUT', body: sourceWithoutScroll });
  await setEditorSource(body);
  const oldViewport = await executeExpression(`JSON.stringify((() => {
    const output = document.getElementById('output');
    output.scrollLeft = output.scrollWidth;
    output.scrollTop = output.scrollHeight;
    return { left: output.scrollLeft, top: output.scrollTop };
  })())`).then(JSON.parse);
  assert.ok(oldViewport.left > 0);
  assert.ok(oldViewport.top > 0);

  await executeExpression(`loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`);
  const restored = await executeExpression(`JSON.stringify((() => {
    const output = document.getElementById('output');
    const pane = output.getBoundingClientRect();
    const first = document.querySelector('#diagram [id*="flowchart-B_FIRST-"]').getBoundingClientRect();
    return {
      left: output.scrollLeft,
      top: output.scrollTop,
      firstVisible: first.left >= pane.left && first.right <= pane.right && first.top >= pane.top && first.bottom <= pane.bottom,
    };
  })())`).then(JSON.parse);
  assert.equal(restored.firstVisible, true, JSON.stringify({ oldViewport, restored }));
  assert.ok(restored.left < oldViewport.left);
  assert.ok(restored.top < oldViewport.top);

  const sourceWithZeroScroll = `${body}\n%%%%====\n%% DO NOT MODIFY - AUTOMATICALLY GENERATED DURING EVERY SAVE\n%% {"lastSelectedNodeId":null,"outputScrollLeft":0,"outputScrollTop":0}\n%%%%====`;
  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`, { method: 'PUT', body: sourceWithZeroScroll });
  await executeExpression(`(() => { const output = document.getElementById('output'); output.scrollLeft = output.scrollWidth; output.scrollTop = output.scrollHeight; })()`);
  await executeExpression(`loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`);
  assert.deepEqual(await executeExpression(`JSON.stringify({ left: document.getElementById('output').scrollLeft, top: document.getElementById('output').scrollTop })`).then(JSON.parse), { left: 0, top: 0 });
  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`, { method: 'PUT', body: editorFixtureSource });
});
