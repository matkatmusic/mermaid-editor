import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "diagram-load.ts"), "utf8");

test("test_diagram_load_reads_the_full_path_from_the_response_header", () => {
  assert.ok(source.includes("state.loadedPath = diagramResponse.headers.get('X-Diagram-Path');"));
});
