import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "class-source.ts"), "utf8");

test("test_class_source_comments_out_a_deleted_class_def_instead_of_removing_it", () => {
  assert.ok(source.includes("export function buildSourceWithDeletedClass(source: string, name: string) {"));
  assert.ok(source.includes("result.push(`%% ${line.trim()}`);"));
});
