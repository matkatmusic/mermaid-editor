import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "render-helpers.ts"), "utf8");

test("test_render_helpers_counts_a_question_after_a_decision_as_its_answer", () => {
  assert.ok(source.includes("(fromIsDecision && idIsQuestion)"));
});
