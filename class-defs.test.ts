import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "class-defs.ts"), "utf8");

test("test_class_defs_applies_each_class_change_through_applyEditorSource", () => {
  assert.ok(source.includes("await applyEditorSource(buildSourceWithAssignedClass(codeBox.value, nodeId, className));"));
  assert.ok(source.includes("export async function removeClass(name: string) {"));
});
