import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse, KeyName, Modifier, pressKey } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const FOUR_BLOCKS_WITH_CLASSES = [
    "flowchart TD",
    '  B_A["A"]',
    '  B_B["B"]',
    '  B_C["C"]',
    '  B_D["D"]',
    "  B_A --> B_B",
    "  B_B --> B_C",
    "  B_C --> B_D",
    "  classDef Action fill:#fc00ff,stroke:#000000",
    "  class B_A,B_B,B_C,B_D Action",
].join("\n");

async function readEditorSource(): Promise<string> {
    return executeExpression("codeBox.value");
}

test("test_delete_key_takes_the_deleted_node_out_of_the_class_line", async () => {
    // Step: a diagram where one class line names four blocks.
    await resetEditorFixture();
    await setEditorSource(FOUR_BLOCKS_WITH_CLASSES);
    // Step: select B_B and press Delete.
    await clickNodeWithMouse("B_B");
    await pressKey(KeyName.Delete);
    // Step: the class line no longer names B_B and keeps the other three.
    const source = await readEditorSource();
    assert.ok(source.includes("\n  class B_A,B_C,B_D Action"), source);
    assert.ok(!source.includes("B_B"), source);
});

test("test_delete_of_two_nodes_cleans_both_class_names_and_undo_restores_the_class_line", async () => {
    // Step: select B_B and B_C, then press Delete.
    await resetEditorFixture();
    await setEditorSource(FOUR_BLOCKS_WITH_CLASSES);
    const sourceBefore = await readEditorSource();
    await clickNodeWithMouse("B_B");
    await clickNodeWithMouse("B_C", Modifier.Meta);
    await pressKey(KeyName.Delete);
    // Step: both names are gone from the class line.
    const sourceAfterDelete = await readEditorSource();
    assert.ok(sourceAfterDelete.includes("\n  class B_A,B_D Action"), sourceAfterDelete);
    // Step: Cmd-Z gives back the exact source from before the delete (the saved scroll trailer is not part of the diagram).
    await pressKey(KeyName.Z, Modifier.Meta);
    assert.equal((await readEditorSource()).split("\n%%%%====")[0], sourceBefore);
});
