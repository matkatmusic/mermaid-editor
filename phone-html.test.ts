import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("test_phone_html_decision_row_puts_choice_count_between_question_and_choice_buttons", () => {
  const source = readFileSync(join(import.meta.dirname, "phone-html.ts"), "utf8");
  assert.ok(source.includes('${question}<div class="phone-choice-count">${choices.length} choices</div>${buildChoiceButtonsHtml(choices, row, graph)}'));
});
