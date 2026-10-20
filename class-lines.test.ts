import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "class-lines.ts"), "utf8");

test("test_class_lines_reads_the_last_class_line_that_lists_the_node", () => {
  assert.ok(source.includes("export function findClassOfNode(source: string, nodeId: string): string | null {"));
  assert.ok(source.includes("found = match[3];"));
});
