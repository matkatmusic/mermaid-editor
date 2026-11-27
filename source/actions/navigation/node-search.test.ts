// Disabled for task #127: tests that only check source text are not wanted.
// import { test } from "node:test";
// import assert from "node:assert/strict";
// import { readFileSync } from "node:fs";
// import { join } from "node:path";

// const source = readFileSync(join(import.meta.dirname, "node-search.ts"), "utf8");

// test("test_node_search_matches_every_case_insensitive_occurrence_in_the_source_text", () => {
//   assert.ok(source.includes("const haystack = codeBox.value.toLowerCase();"));
//   assert.ok(source.includes("start = haystack.indexOf(needle, start + needle.length);"));
// });
