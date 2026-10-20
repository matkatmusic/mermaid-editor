import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "path-export.ts"), "utf8");

test("test_path_export_lists_a_question_answer_once", () => {
  assert.ok(source.includes("const isAlreadyListed = ids[ids.length - 1] === row.id;"));
});
