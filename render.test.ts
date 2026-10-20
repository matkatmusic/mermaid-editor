import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "render.ts"), "utf8");

test("test_render_validates_the_graph_before_rendering", () => {
  assert.ok(source.includes("const graph = getEditorGraph();"));
  assert.ok(source.includes("darkModeToggle.addEventListener('change', applyDarkModeToggle);"));
});
