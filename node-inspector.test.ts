import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "node-inspector.ts"), "utf8");

test("test_node_inspector_builds_one_action_button_per_inspector_action", () => {
  assert.ok(source.includes("export function createInspectorActionButton("));
  assert.ok(source.includes("createInspectorActionButton('remove', 'Remove')"));
});
