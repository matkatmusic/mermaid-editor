import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression, waitMilliseconds } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse, Modifier } from "../../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const THREE_BLOCKS = 'flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_A --> B_B';

test("test_real_mouse_shift_click_on_two_nodes_adds_an_edge_from_the_first_to_the_second", async () => {
    // Step: three blocks; only B_A --> B_B exists.
    await resetEditorFixture();
    await setEditorSource(THREE_BLOCKS);
    // Step: hold Shift and click the centre of B_C with a real mouse press and release, then the same on B_A.
    await clickNodeWithMouse("B_C", Modifier.Shift);
    await clickNodeWithMouse("B_A", Modifier.Shift);
    await waitMilliseconds(500);
    // Step: the source gained `B_C --> B_A` and kept `B_A --> B_B`.
    const source: string = await executeExpression("codeBox.value");
    assert.ok(source.includes("B_C --> B_A"), source);
    assert.ok(source.includes("B_A --> B_B"), source);
});
