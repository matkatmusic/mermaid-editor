import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("test_state_has_functions_only_defaulting_to_false", () => {
  const source = readFileSync(join(import.meta.dirname, "state.ts"), "utf8");
  assert.ok(source.includes("functionsOnly: false,"));
});
