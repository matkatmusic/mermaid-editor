import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "source-lines.ts"), "utf8");
const eventsSource = readFileSync(join(import.meta.dirname, "editor-events.ts"), "utf8");

test("test_source_lines_measures_each_line_top_with_one_hidden_mirror", () => {
  assert.ok(source.includes("export function measureSourceLines() {"));
  assert.ok(source.includes("white-space:pre-wrap;overflow-wrap:break-word"));
  assert.ok(source.includes("offsetTop"));
});

test("test_source_lines_draws_the_gutter_and_the_selected_line_band", () => {
  assert.ok(source.includes("export function renderSourceLines() {"));
  assert.ok(source.includes("sourceGutter.scrollTop = codeBox.scrollTop;"));
  assert.ok(source.includes("codeBox.style.backgroundImage"));
  assert.ok(source.includes("new ResizeObserver(renderSourceLines).observe(codeBox);"));
});

test("test_editor_events_scrolls_to_a_line_with_the_shared_mirror", () => {
  assert.ok(eventsSource.includes("measureSourceLines()"));
  assert.ok(!eventsSource.includes("document.createElement('div')"));
});
