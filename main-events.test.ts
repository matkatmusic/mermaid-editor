import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "main-events.ts"), "utf8");

test("test_main_events_open_file_button_runs_the_server_dialog_handler", () => {
  assert.ok(source.includes("openFileBtn.addEventListener('click', openFileFromDialog);"));
});
