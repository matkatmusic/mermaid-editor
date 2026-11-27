// Disabled for task #127: tests that only check source text are not wanted.
// import { test } from "node:test";
// import assert from "node:assert/strict";
// import { readFileSync } from "node:fs";
// import { join } from "node:path";
//
// const source = readFileSync(join(import.meta.dirname, "open-file.ts"), "utf8");
//
// test("test_open_file_fetches_the_server_dialog_and_returns_on_cancel", () => {
//   assert.ok(source.includes("const openResponse = await fetch('/api/open-file');"));
//   assert.ok(source.includes("if (openResponse.status === 204) {"));
// });
//
// test("test_open_file_watches_the_opened_path_and_records_its_text_as_the_saved_baseline", () => {
//   assert.ok(source.includes("setLastSavedDiagramText(text);"));
//   assert.ok(source.includes("createDiagramWatcher(path, '/api/watch-opened?path=' + encodeURIComponent(path), '/api/opened-file?path=' + encodeURIComponent(path));"));
// });
