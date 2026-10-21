import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { SCROLL_FIXTURE_NAME, scrollFixtureSource } from "./fixtures.ts";
import { measureSourceLineBounds, openEditorDrawer } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const gutterNumbers = "Array.from(document.querySelectorAll('#sourceGutter span'))";

test("test_gutter_shows_one_number_per_line_and_lines_up_with_the_first_row_of_a_wrapped_line", async () => {
  // Scenario: a loaded diagram shows numbers 1..N and each number sits at the top of its line.
  await executeExpression(`loadDiagram(${JSON.stringify(SCROLL_FIXTURE_NAME)})`);
  await waitMilliseconds(500);
  const lineCount = await executeExpression("codeBox.value.split('\\n').length");
  const texts = await executeExpression(`JSON.stringify(${gutterNumbers}.map((el) => el.textContent))`).then(JSON.parse);
  assert.deepEqual(texts, Array.from({ length: lineCount }, (_, i) => String(i + 1)));

  // Step: a wrapped line's number sits at its first row.
  const wrappedIndex = await executeExpression("codeBox.value.split('\\n').findIndex((line) => line.length > 80)");
  assert.ok(wrappedIndex > 0);
  const bounds = await measureSourceLineBounds(wrappedIndex);
  assert.ok(bounds.bottom - bounds.top > bounds.lineHeight * 1.5, JSON.stringify(bounds));
  const numberTops = await executeExpression(`JSON.stringify(${gutterNumbers}.map((el) => el.offsetTop))`).then(JSON.parse);
  assert.ok(Math.abs(numberTops[wrappedIndex] - bounds.top) <= 1, `${numberTops[wrappedIndex]} vs ${bounds.top}`);
  assert.ok(Math.abs(numberTops[wrappedIndex + 1] - bounds.bottom) <= 1, `${numberTops[wrappedIndex + 1]} vs ${bounds.bottom}`);
});

test("test_gutter_follows_the_code_box_scroll_and_updates_on_input", async () => {
  // Scenario: scrolling the textarea scrolls the gutter, and typing a new line adds a number.
  await executeExpression(`loadDiagram(${JSON.stringify(SCROLL_FIXTURE_NAME)})`);
  await waitMilliseconds(500);
  await executeExpression("codeBox.scrollTop = 300");
  await waitMilliseconds(500);
  assert.equal(await executeExpression("codeBox.scrollTop"), 300);
  assert.equal(await executeExpression("document.getElementById('sourceGutter').scrollTop"), 300);

  // Step: a typed newline adds one number, and the gutter stays on the textarea's scroll position.
  const before = await executeExpression(`${gutterNumbers}.length`);
  await executeExpression("codeBox.value += '\\n  B_EXTRA[x]'; codeBox.dispatchEvent(new Event('input'))");
  await waitMilliseconds(300);
  assert.equal(await executeExpression(`${gutterNumbers}.length`), before + 1);
  assert.equal(await executeExpression("document.getElementById('sourceGutter').scrollTop"), await executeExpression("codeBox.scrollTop"));

  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${SCROLL_FIXTURE_NAME}`, { method: "PUT", body: scrollFixtureSource });
});
