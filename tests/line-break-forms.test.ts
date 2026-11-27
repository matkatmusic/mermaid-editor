import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse, KeyName, pressKey } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const LINE_BREAK_FORMS = [["<br>", "B_A", "One<br>Two"], ["<br/>", "B_B", "Three<br/>Four"], ["<br />", "B_C", "Five<br />Six"]];

function buildSource() {
    return [
        "flowchart TD",
        ...LINE_BREAK_FORMS.map(([, id, label]) => `  ${id}["${label}"]`),
        ...LINE_BREAK_FORMS.map(([, , label], index) => `  %% ==props==: {"blockId":"B_N${index}","note":"${label}"}\n  B_N${index}["Note ${index}"]`),
        "  B_A --> B_B --> B_C",
    ].join("\n");
}

for (const [form, id, label] of LINE_BREAK_FORMS) {
    test(`test_node_text_box_shows_${id}_with_the_${form.replace(/\W/g, "x")}_form_as_a_line_break`, async () => {
        await resetEditorFixture();
        await setEditorSource(buildSource());
        await waitMilliseconds(500);
        await clickNodeWithMouse(id);
        await waitMilliseconds(300);
        assert.equal(await executeExpression("document.getElementById('nodeTextInput').value"), label.replace(form, "\n"));
    });
}

for (const [form, , label] of LINE_BREAK_FORMS) {
    test(`test_notes_box_shows_the_${form.replace(/\W/g, "x")}_form_as_a_line_break`, async () => {
        await resetEditorFixture();
        await setEditorSource(buildSource());
        await waitMilliseconds(500);
        const index = LINE_BREAK_FORMS.findIndex(([, , other]) => other === label);
        await clickNodeWithMouse(`B_N${index}`);
        await waitMilliseconds(300);
        assert.equal(await executeExpression("document.getElementById('nodeNotesInput').value"), label.replace(form, "\n"));
    });
}

test("test_save_of_node_text_with_a_br_space_slash_form_writes_br_slash", async () => {
    await resetEditorFixture();
    await setEditorSource(buildSource());
    await waitMilliseconds(500);
    await clickNodeWithMouse("B_C");
    await waitMilliseconds(300);
    await executeExpression("(() => { const box = document.getElementById('nodeTextInput'); box.focus(); box.setSelectionRange(box.value.length, box.value.length); })()");
    await send("Input.insertText", { text: "!" });
    await pressKey(KeyName.Enter);
    await executeExpression("window.editorActionPromise");
    await waitMilliseconds(500);
    // const lines: string[] = (await executeExpression("codeBox.value")).split("\n");
    const lines: string[] = (await executeExpression<string>("codeBox.value")).split("\n");
    assert.ok(lines.includes('  B_C["Five<br/>Six!"]'), lines.join("|"));
});

test("test_save_of_a_note_with_a_br_form_writes_br_slash", async () => {
    await resetEditorFixture();
    await setEditorSource(buildSource());
    await waitMilliseconds(500);
    await clickNodeWithMouse("B_N0");
    await waitMilliseconds(300);
    await executeExpression("(() => { const box = document.getElementById('nodeNotesInput'); box.focus(); box.setSelectionRange(box.value.length, box.value.length); })()");
    await send("Input.insertText", { text: "!" });
    await pressKey(KeyName.Enter);
    await executeExpression("window.editorActionPromise");
    await waitMilliseconds(500);
    // const lines: string[] = (await executeExpression("codeBox.value")).split("\n");
    const lines: string[] = (await executeExpression<string>("codeBox.value")).split("\n");
    assert.ok(lines.includes('  %% ==props==: {"blockId":"B_N0","note":"One<br/>Two!"}'), lines.join("|"));
});
