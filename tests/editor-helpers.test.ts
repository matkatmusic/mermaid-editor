import { test } from "node:test";
import assert from "node:assert/strict";
import * as helpers from "./editor-helpers.ts";

test("test_editor_helpers_export_every_helper_the_browser_tests_call", () => {
  const names = ["openEditorDrawer", "getNodeIds", "resetEditorFixture", "selectEditorNode", "executeEditorAction", "assertEditorSourceIsSavedAndValid", "dispatchNodeClick", "dispatchNodeDblclick", "setEditorSource", "getOutputScrollTop", "measureSourceLineBounds", "findNodeLineIndex"];
  for (const name of names)
    assert.equal(typeof helpers[name as keyof typeof helpers], "function", name);
});
