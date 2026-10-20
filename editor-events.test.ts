import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "editor-events.ts"), "utf8");

test("test_editor_events_selects_the_node_source_line_before_selecting_the_editor_node", () => {
  assert.ok(source.includes("codeBox.setSelectionRange(start, start + lines[i].length);"));
  const sourceLineCall = source.indexOf("selectNodeSourceLine(id);");
  const editorNodeCall = source.indexOf("selectEditorNode(id);");
  assert.ok(sourceLineCall !== -1 && sourceLineCall < editorNodeCall);
});
