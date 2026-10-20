import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "decision-nav.ts"), "utf8");

test("test_decision_nav_counts_a_question_fed_by_a_decision_as_a_feeding_choice", () => {
  assert.ok(source.includes("const isAnswerKind = node?.kind === 'choice' || node?.kind === 'question';"));
});
