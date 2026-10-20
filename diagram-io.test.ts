import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("test_diagram_io_load_diagram_stores_loaded_name_in_session_storage", () => {
  const source = readFileSync(join(import.meta.dirname, "diagram-io.ts"), "utf8");
  assert.ok(source.includes("state.currentName = name;\n  sessionStorage.setItem('loadedDiagram', name);"));
});
