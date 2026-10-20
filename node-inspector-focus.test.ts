import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "node-inspector-focus.ts"), "utf8");

test("test_node_inspector_focus_selects_the_text_input", () => {
  assert.ok(source.includes("export function setInspectorTextFocus() {"));
  assert.ok(source.includes("nodeTextInput.select();"));
});
