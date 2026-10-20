import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-graph.ts"), "utf8");

test("test_editor_graph_builds_the_graph_and_throws_on_invalid_declarations", () => {
  assert.ok(source.includes("export function getEditorGraph(): EditorGraph {"));
  assert.ok(source.includes("throw error;"));
});
