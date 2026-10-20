import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "phone-render.ts"), "utf8");

test("test_phone_render_continues_at_an_answer_that_is_a_question", () => {
  assert.ok(source.includes("cur = isAnswerAQuestion ? answered : choicesOf(answered, edges)[0];"));
  assert.ok(source.includes("const nextNodeId = isChoiceAQuestion ? choiceId : choicesOf(choiceId, edges)[0];"));
});
