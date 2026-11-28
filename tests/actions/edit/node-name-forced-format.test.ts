import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse, KeyName, pressKey } from "../../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const SOURCE = 'flowchart TD\n  B_A["Alpha"]\n  B_B["Beta"]\n  B_A --> B_B';

async function selectBlockA() {
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    // await waitMilliseconds(500);
    await clickNodeWithMouse("B_A");
    // await waitMilliseconds(300);
}

async function typeIntoNodeNameBox(text: string) {
    await executeExpression("(() => { const box = document.getElementById('nodeNameInput'); box.focus(); box.select(); })()");
    for (const character of text)
        await send("Input.dispatchKeyEvent", { type: "char", text: character, key: character });
}

async function readNodeNameBoxValue(): Promise<string> {
    return executeExpression("document.getElementById('nodeNameInput').value");
}

test("test_typed_lower_case_letters_show_as_capitals_at_once", async () => {
    await selectBlockA();
    await typeIntoNodeNameBox("abc");
    assert.equal(await readNodeNameBoxValue(), "ABC");
});

test("test_typed_space_shows_as_an_underscore_at_once", async () => {
    await selectBlockA();
    await typeIntoNodeNameBox("my node");
    assert.equal(await readNodeNameBoxValue(), "MY_NODE");
});

test("test_enter_renames_the_node_to_capitals_with_underscores", async () => {
    await selectBlockA();
    await typeIntoNodeNameBox("my node");
    await pressKey(KeyName.Enter);
    await executeExpression("window.editorActionPromise");
    // await waitMilliseconds(500);
    const source: string = await executeExpression("codeBox.value");
    assert.ok(source.includes('  B_MY_NODE["Alpha"]'), source);
    assert.ok(!source.includes("B_A["), source);
});

test("test_typing_in_the_middle_keeps_the_caret_where_it_was_typed", async () => {
    await selectBlockA();
    await typeIntoNodeNameBox("ac");
    await executeExpression("(() => { const box = document.getElementById('nodeNameInput'); box.setSelectionRange(1, 1); })()");
    await send("Input.dispatchKeyEvent", { type: "char", text: "b", key: "b" });
    assert.equal(await readNodeNameBoxValue(), "ABC");
    assert.equal(await executeExpression("document.getElementById('nodeNameInput').selectionStart"), 2);
    assert.equal(await executeExpression("document.getElementById('nodeNameInput').selectionEnd"), 2);
});
