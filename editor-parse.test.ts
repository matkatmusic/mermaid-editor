import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-parse.ts"), "utf8");

test("test_editor_parse_splits_an_edge_line_into_segments", () => {
  assert.ok(source.includes("export function parseEditorEdgeLine(line: string) {"));
  assert.ok(source.includes("segments.push({ fromToken: tokens[index], label: labels[index], toToken: tokens[index + 1] });"));
});
