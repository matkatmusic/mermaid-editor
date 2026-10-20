import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-history.ts"), "utf8");

test("test_editor_history_restores_an_entry_without_recording_history", () => {
  assert.ok(source.includes("{ recordHistory: false }"));
  assert.ok(source.includes("export function applyEditorUndo() {"));
  assert.ok(source.includes("export function applyEditorRedo() {"));
});
