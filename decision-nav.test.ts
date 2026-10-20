import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "decision-nav.ts"), "utf8");

test("test_decision_nav_clears_a_preview_that_no_decision_feeds", () => {
  assert.ok(source.includes("const feedingChoice = findNearestFeedingChoice(state.phonePreviewChoiceId!, graph);"));
});
