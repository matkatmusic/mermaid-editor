import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-classes-dialog.ts"), "utf8");

test("test_editor_classes_dialog_wires_the_menu_new_and_list_events", () => {
  assert.ok(source.includes("classesMenuBtn.addEventListener('click', openClassesDialog);"));
  assert.ok(source.includes("classesList.addEventListener('change', updateClassFromRow);"));
});
