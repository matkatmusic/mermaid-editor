import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-actions.ts"), "utf8");

test("test_editor_actions_auto_save_counts_loaded_path_as_a_save_target", () => {
  assert.ok(source.includes("const hasSaveTarget = !!state.currentName || !!state.openedFileHandle || !!state.loadedPath;"));
});
