import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-inspector-events.ts"), "utf8");

test("test_inspector_events_tab_key_commits_node_text", () => {
  assert.ok(source.includes("const isTab = event.key === 'Tab';"));
  assert.ok(source.includes("nodeTextInput.addEventListener('keydown', writeNodeTextOnCommitKey);"));
});

test("test_inspector_events_change_listener_commits_node_text", () => {
  assert.ok(source.includes("nodeTextInput.addEventListener('change', writeNodeTextOnChange);"));
  assert.ok(source.includes("commitNodeText(id, text);"));
});
