import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-metadata.ts"), "utf8");

test("test_editor_metadata_writes_the_generated_trailer_after_the_source", () => {
  assert.ok(source.includes("export function buildSourceWithMetadata(source: string) {"));
  assert.ok(source.includes("return `${body}\\n${EDITOR_METADATA_FENCE}"));
});
