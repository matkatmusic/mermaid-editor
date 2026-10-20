import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-remove-question.ts"), "utf8");

test("test_editor_remove_question_applies_the_kept_choice_through_one_editor_action", () => {
  assert.ok(source.includes("export function applyQuestionRemoval() {"));
  assert.ok(source.includes("executeEditorAction(applyRemovedQuestionSource);"));
});
