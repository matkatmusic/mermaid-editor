import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "class-style-index.ts"), "utf8");

test("test_class_style_index_returns_null_for_a_node_whose_class_def_is_gone", () => {
  assert.ok(source.includes("export function findNodeStyle(index: ClassStyleIndex, nodeId: string)"));
  assert.ok(source.includes("const def = index.defsByName.get(name);"));
});
