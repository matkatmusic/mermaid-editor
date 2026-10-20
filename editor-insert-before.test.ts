import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-insert-before.ts"), "utf8");

test("test_editor_insert_before_points_the_new_static_block_at_the_selected_node", () => {
  assert.ok(source.includes("newLines.push(`  ${staticId} --> ${selected}`);"));
});
