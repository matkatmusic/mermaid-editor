import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-classes-render.ts"), "utf8");

test("test_editor_classes_render_writes_one_row_per_class", () => {
  assert.ok(source.includes("export function renderClassesDialog() {"));
  assert.ok(source.includes('<div class="classes-row" data-class-name="${def.name}">'));
});
