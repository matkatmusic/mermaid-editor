import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse, KeyName, pressKey } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

// The note of B_A is at the end of the file, and the note of B_B is directly above B_A.
const SOURCE = [
    "flowchart TD",
    '  %% ==props==: {"blockId":"B_B","note":"note of beta"}',
    '  B_A["Alpha"]',
    '  B_B["Beta"]',
    "  B_A --> B_B",
    '  %% ==props==: {"blockId":"B_A","note":"keep the word B_A"}',
].join("\n");

async function openSourceAndSelectAlpha() {
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    await waitMilliseconds(500);
    await clickNodeWithMouse("B_A");
    await waitMilliseconds(300);
}

async function replaceTextInBoxAndPressEnter(boxId: string, text: string) {
    await executeExpression(`(() => { const box = document.getElementById('${boxId}'); box.focus(); box.select(); })()`);
    await send("Input.insertText", { text });
    await pressKey(KeyName.Enter);
    await executeExpression("window.editorActionPromise");
    await waitMilliseconds(500);
}

test("test_the_notes_box_shows_the_note_that_names_the_selected_block", async () => {
    await openSourceAndSelectAlpha();
    assert.equal(await executeExpression("document.getElementById('nodeNotesInput').value"), "keep the word B_A");
});

test("test_writing_a_note_replaces_only_the_note_lines_of_that_block", async () => {
    // Step: write a new note for B_A.
    await openSourceAndSelectAlpha();
    await replaceTextInBoxAndPressEnter("nodeNotesInput", "new text");
    // Step: the old note line of B_A is gone, the new one is above B_A, and the note of B_B stays.
    const lines: string[] = (await executeExpression("codeBox.value")).split("\n");
    assert.deepEqual(lines.slice(0, 5), [
        "flowchart TD",
        '  %% ==props==: {"blockId":"B_B","note":"note of beta"}',
        '  %% ==props==: {"blockId":"B_A","note":"new text"}',
        '  B_A["Alpha"]',
        '  B_B["Beta"]',
    ]);
    assert.equal(lines.filter((line) => line.includes('"blockId":"B_A"')).length, 1, lines.join("|"));
});

test("test_renaming_a_block_renames_the_block_id_in_its_props_line_but_not_the_note_text", async () => {
    // Step: rename B_A to B_FIRST in the Node Name box.
    await openSourceAndSelectAlpha();
    await replaceTextInBoxAndPressEnter("nodeNameInput", "FIRST");
    // Step: the note line names B_FIRST and keeps the words of the user.
    const source: string = await executeExpression("codeBox.value");
    assert.ok(source.includes('  %% ==props==: {"blockId":"B_FIRST","note":"keep the word B_A"}'), source);
});
