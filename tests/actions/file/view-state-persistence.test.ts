import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "../../browser-harness.ts";
import { executeExpression, waitForRender, waitMilliseconds } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, dispatchNodeClick } from "../../editor-helpers.ts";
import { EDITOR_FIXTURE_NAME, SEARCH_FIXTURE } from "../../fixtures.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

function readTrailerNodeId(sourceText: string): string | null {
  const trailerMatch = sourceText.match(/^%% (\{.*\})$/m);
  // return JSON.parse(trailerMatch![1]).lastSelectedNodeId;
  const trailer: { fileFormatVersion: number; lastSelectedNodeId: string | null; outputScrollLeft: number; outputScrollTop: number; mainZoomPercent: number } = JSON.parse(trailerMatch![1]);
  return trailer.lastSelectedNodeId;
}

test("test_clicking_a_node_writes_its_id_into_the_editor_text_and_the_saved_file", async () => {
  // Scenario: a user click on a node updates the lastSelectedNodeId trailer, in the drawer text and on disk.
  await resetEditorFixture();
  // Step: load a search fixture so the node ids are known, then save it with a trailer that selects nothing.
  await executeExpression(`codeBox.value = ${JSON.stringify(SEARCH_FIXTURE)}; codeBox.dispatchEvent(new Event('input'))`);
  await waitForRender();
  await executeExpression("window.selectEditorNode('B_START'); window.selectEditorNode(null)");
  // Step: click the node Q_SECOND.
  await dispatchNodeClick("Q_SECOND");
  await waitMilliseconds(700);
  // Step: the trailer in the drawer text names Q_SECOND.
  assert.equal(readTrailerNodeId(await executeExpression("codeBox.value")), "Q_SECOND");
  // Step: the file on disk names Q_SECOND too.
  const diskResponse = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`);
  assert.equal(readTrailerNodeId(await diskResponse.text()), "Q_SECOND");
});

test("test_a_file_opened_by_path_restores_its_selected_node_and_scroll_position", async () => {
  // Scenario: a page refresh reloads the last opened path file; its saved selection and scroll come back.
  const diagramResponse = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/accountability.mmd`);
  const diagramText = (await diagramResponse.text()).replace(/\n%%%%====[\s\S]*$/, "");
  const trailer = `\n%%%%====\n%% DO NOT MODIFY - AUTOMATICALLY GENERATED DURING EVERY SAVE\n%% ${JSON.stringify({ lastSelectedNodeId: "B_SELF_LISTEN", outputScrollLeft: 0, outputScrollTop: 40, mainZoomPercent: 100 })}\n%%%%====`;
  // Step: show the text as a path-opened file.
  await executeExpression(`window.showOpenedFile('/tmp/restore-test.mmd', ${JSON.stringify(diagramText + trailer)})`);
  await waitMilliseconds(1500);
  // Step: the diagram can scroll at least 40 pixels, so the saved scroll is reachable.
  assert.equal(await executeExpression("document.getElementById('output').scrollHeight - document.getElementById('output').clientHeight >= 40"), true);
  // Step: the saved node is selected and the saved scroll is applied.
  assert.equal(await executeExpression("document.getElementById('selectedNode').textContent"), "B_SELF_LISTEN");
  assert.equal(await executeExpression("document.getElementById('output').scrollTop"), 40);
});
