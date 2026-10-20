import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "decision-search.ts"), "utf8");

test("test_decision_search_counts_a_question_fed_by_a_decision_as_a_feeding_choice", () => {
  assert.ok(source.includes("const isAnswerKind = isChoice || isQuestion;"));
});
