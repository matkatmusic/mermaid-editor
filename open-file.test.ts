import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "open-file.ts"), "utf8");

test("test_open_file_fetches_the_server_dialog_and_returns_on_cancel", () => {
  assert.ok(source.includes("const openResponse = await fetch('/api/open-file');"));
  assert.ok(source.includes("if (openResponse.status === 204) {"));
});
