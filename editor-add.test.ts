import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-add.ts"), "utf8");

test("test_editor_add_names_a_choice_from_its_label", () => {
  assert.ok(source.includes("export function getChoiceSuffixFromLabel(label: string) {"));
  assert.ok(source.includes("const cid = buildChoiceId(questionId, suffix);"));
});
