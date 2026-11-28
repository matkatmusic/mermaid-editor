import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
// import { executeExpression, send, waitMilliseconds } from "../../cdp.ts";
import { executeExpression, send } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse, KeyName, pressKey } from "../../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test("test_real_enter_writes_a_typed_double_quote_as_quot_entity", async () => {
    // Scenario: select a node with a real click, type a text with a " in Node text, press the real Enter key.
    await resetEditorFixture();
    await setEditorSource('flowchart TD\n  B_A["Alpha"]\n  B_B["Beta"]\n  B_A --> B_B');
    // await waitMilliseconds(500);
    await clickNodeWithMouse("B_A");
    await executeExpression("(() => { const input = document.getElementById('nodeTextInput'); input.focus(); input.select(); })()");
    await send("Input.insertText", { text: 'Say "hi" now' });
    await pressKey(KeyName.Enter);
    await executeExpression("window.editorActionPromise");
    // await waitMilliseconds(500);
    // The file holds the entity, not the quote.
    // const lines: string[] = (await executeExpression("codeBox.value")).split("\n");
    const lines: string[] = (await executeExpression<string>("codeBox.value")).split("\n");
    assert.ok(lines.includes('  B_A["Say #quot;hi#quot; now"]'), lines.join("|"));
    assert.equal(await executeExpression("document.getElementById('error').textContent"), "");
    // The diagram and the Node text box show the quote.
    // assert.ok((await executeExpression(`document.querySelector('#diagram [id*="flowchart-B_A-"]').textContent`)).includes('Say "hi" now'));
    assert.ok((await executeExpression<string>(`document.querySelector('#diagram [id*="flowchart-B_A-"]').textContent`)).includes('Say "hi" now'));
    assert.equal(await executeExpression("document.getElementById('nodeTextInput').value"), 'Say "hi" now');
});
