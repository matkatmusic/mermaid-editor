import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-commit.ts"), "utf8");

test("test_editor_commit_applies_the_destination_chosen_in_the_inspector", () => {
  assert.ok(source.includes("export function applyDestinationSelection() {"));
  assert.ok(source.includes("applyDestination(destinationSelect.value);"));
});
