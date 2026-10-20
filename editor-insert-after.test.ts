import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-insert-after.ts"), "utf8");

test("test_editor_insert_after_adds_a_yes_and_a_no_choice_to_a_new_decision", () => {
  assert.ok(source.includes("export async function insertDecisionAfterNode(sourceId: string, graph: EditorGraph) {"));
  assert.ok(source.includes("`  ${decisionId} --> ${noId}`,"));
});
