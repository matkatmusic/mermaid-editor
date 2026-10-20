import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "diagram-save.ts"), "utf8");

test("test_diagram_save_writes_a_path_opened_file_through_the_server_and_throws_on_failure", () => {
  assert.ok(source.includes("fetch('/api/open-file', { method: 'PUT', body: codeBox.value })"));
  assert.ok(source.includes("throw new Error(await openFileResponse.text());"));
});
