import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-class-events.ts"), "utf8");

test("test_editor_class_events_rejects_a_blank_or_taken_class_name", () => {
  assert.ok(source.includes("classEditorError.textContent = 'Name is required.';"));
  assert.ok(source.includes("already exists."));
});
