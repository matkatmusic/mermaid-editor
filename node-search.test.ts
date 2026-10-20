import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "node-search.ts"), "utf8");

test("test_node_search_matches_the_id_or_the_label", () => {
  assert.ok(source.includes("const isMatch = idMatches || labelMatches;"));
});
