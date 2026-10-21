import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { SCROLL_FIXTURE_NAME, scrollFixtureSource } from "./fixtures.ts";
import { dispatchNodeClick, findNodeLineIndex, measureSourceLineBounds, openEditorDrawer, selectEditorNode } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const FIRST_NODE_ID = "Q_THEM_DONE_SPEAKING";
const SECOND_NODE_ID = "Q_CLARIFY_ISSUE_COUNT";

async function readHighlightBand() {
  // The band is the lowest and highest pixel offset in the textarea's background gradient.
  const image: string = await executeExpression("getComputedStyle(codeBox).backgroundImage");
  if (image === "none")
    return null;
  const offsets = Array.from(image.matchAll(/(-?[\d.]+)px/g), (match) => Number(match[1]));
  return { top: Math.min(...offsets), bottom: Math.max(...offsets) };
}

async function assertBandCoversNodeLine(id: string) {
  const bounds = await measureSourceLineBounds(await findNodeLineIndex(id));
  const band = await readHighlightBand();
  assert.ok(band, "expected a highlight band");
  assert.ok(Math.abs(band.top - bounds.top) <= 1, `top ${band.top} vs ${bounds.top}`);
  assert.ok(Math.abs(band.bottom - bounds.bottom) <= 1, `bottom ${band.bottom} vs ${bounds.bottom}`);
  assert.ok(bounds.bottom - bounds.top > bounds.lineHeight * 1.5, "the line should wrap");
}

test("test_selected_node_line_gets_a_band_that_moves_with_the_selection_and_clears", async () => {
  // Scenario: a node click highlights its whole wrapped line; another click moves it; a null selection clears it.
  await executeExpression(`loadDiagram(${JSON.stringify(SCROLL_FIXTURE_NAME)})`);
  await waitMilliseconds(500);
  await executeExpression("codeBox.scrollTop = 0");
  await selectEditorNode(null);
  assert.equal(await readHighlightBand(), null);

  await dispatchNodeClick(FIRST_NODE_ID);
  await assertBandCoversNodeLine(FIRST_NODE_ID);
  assert.equal(await executeExpression("getComputedStyle(codeBox).backgroundAttachment"), "local");

  await dispatchNodeClick(SECOND_NODE_ID);
  await assertBandCoversNodeLine(SECOND_NODE_ID);

  // Step: a narrower editor wraps the line differently, and the band follows the new rows.
  await executeExpression("document.getElementById('editor').style.width = '260px'");
  await waitMilliseconds(500);
  await assertBandCoversNodeLine(SECOND_NODE_ID);

  await selectEditorNode(null);
  assert.equal(await readHighlightBand(), null);

  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${SCROLL_FIXTURE_NAME}`, { method: "PUT", body: scrollFixtureSource });
});
