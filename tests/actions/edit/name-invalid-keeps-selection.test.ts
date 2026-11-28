import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse, getHighlightedNodeIds, KeyName, Modifier, pressKey } from "../../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const SOURCE = 'flowchart TD\n  B_A["Alpha"]\n  B_B["Beta"]\n  B_A --> B_B';

async function selectBlockAndTypeBadName() {
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    // await waitMilliseconds(500);
    await clickNodeWithMouse("B_A");
    // await waitMilliseconds(300);
    await executeExpression("(() => { const box = document.getElementById('nodeNameInput'); box.focus(); box.select(); })()");
    await send("Input.insertText", { text: "bad-name" });
}

async function assertSelectionStayedWithErrorAndNotice() {
    assert.equal(await executeExpression("selectedEditorNodeId"), "B_A");
    assert.deepEqual(await getHighlightedNodeIds(), ["B_A"]);
    assert.equal(await executeExpression("multiSelectedNodeIds.length"), 0);
    assert.equal(await executeExpression("document.getElementById('nodeNameInput').value"), "BAD-NAME");
    assert.equal(await executeExpression("document.getElementById('nodeNameCheck').classList.contains('error')"), true);
    // assert.ok((await executeExpression("document.getElementById('nodeNameCheck').textContent")).includes("cannot contain"));
    assert.ok((await executeExpression<string>("document.getElementById('nodeNameCheck').textContent")).includes("cannot contain"));
    // const notice = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const notice: { visible: boolean; text: string } = JSON.parse(await executeExpression<string>(`JSON.stringify((() => {
        const element = document.getElementById('inspectorNotice');
        const rect = element.getBoundingClientRect();
        return { visible: rect.width > 0 && rect.height > 0, text: element.textContent };
    })())`));
    assert.equal(notice.visible, true);
    assert.equal(notice.text, "Fix the bad Node Name first.");
}

test("test_click_on_another_node_is_refused_while_the_node_name_is_invalid", async () => {
    await selectBlockAndTypeBadName();
    await clickNodeWithMouse("B_B");
    await assertSelectionStayedWithErrorAndNotice();
});

test("test_cmd_click_on_another_node_is_refused_while_the_node_name_is_invalid", async () => {
    await selectBlockAndTypeBadName();
    await clickNodeWithMouse("B_B", Modifier.Meta);
    await assertSelectionStayedWithErrorAndNotice();
});

test("test_arrow_key_is_refused_while_the_node_name_is_invalid", async () => {
    await selectBlockAndTypeBadName();
    // Step: a refused click leaves the focus on the page, where the arrow keys work.
    await clickNodeWithMouse("B_B");
    await executeExpression("document.getElementById('inspectorNotice').hidden = true");
    await pressKey(KeyName.ArrowDown);
    await assertSelectionStayedWithErrorAndNotice();
});

test("test_click_on_another_node_works_again_after_the_name_is_fixed", async () => {
    await selectBlockAndTypeBadName();
    await clickNodeWithMouse("B_B");
    await executeExpression("(() => { const box = document.getElementById('nodeNameInput'); box.focus(); box.select(); })()");
    await send("Input.insertText", { text: "GOOD" });
    await pressKey(KeyName.Enter);
    await executeExpression("window.editorActionPromise");
    // await waitMilliseconds(300);
    await clickNodeWithMouse("B_B");
    assert.equal(await executeExpression("selectedEditorNodeId"), "B_B");
});
