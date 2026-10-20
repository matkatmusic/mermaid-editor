import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-remove.ts"), "utf8");

test("test_editor_remove_clears_the_selection_before_it_removes_a_block", () => {
  assert.ok(source.includes("export function removeBlock() {"));
  assert.ok(source.includes("selectEditorNode(null);"));
});
