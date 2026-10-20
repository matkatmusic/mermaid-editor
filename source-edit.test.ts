import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "source-edit.ts"), "utf8");

test("test_source_edit_builds_a_choice_id_from_the_question_id", () => {
  assert.ok(source.includes("return `Q_CHOICE_${questionId.replace(/^Q_/, '')}_${suffix}`;"));
});
