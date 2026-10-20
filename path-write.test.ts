import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "path-write.ts"), "utf8");

test("test_path_write_names_the_next_path_file_after_the_highest_used_number", () => {
  assert.ok(source.includes("export function findNextPathFileName(baseName: string, existingNames: string[]): string {"));
  assert.ok(source.includes("return `${baseName}-path-${nextNumber}.mmd`;"));
});
