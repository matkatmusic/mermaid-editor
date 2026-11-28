import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse, KeyName, pressKey, pressShiftEnter } from "../../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const SOURCE = 'flowchart TD\n  B_A["Alpha"]\n  B_B["Beta"]\n  B_A --> B_B';

async function selectNodeAndFocusBox(id: string, boxId: string) {
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    // await waitMilliseconds(500);
    await clickNodeWithMouse(id);
    // await waitMilliseconds(300);
    await executeExpression(`(() => { const box = document.getElementById('${boxId}'); box.focus(); box.select(); })()`);
}

async function getSourceLines(): Promise<string[]> {
    // return (await executeExpression("codeBox.value")).split("\n");
    return (await executeExpression<string>("codeBox.value")).split("\n");
}

async function pressEnterAndWaitForWrite() {
    await pressKey(KeyName.Enter);
    await executeExpression("window.editorActionPromise");
    // await waitMilliseconds(500);
}

test("test_shift_enter_in_node_text_adds_a_line_break_and_does_not_write", async () => {
    // Scenario: type One, Shift-Enter, type Two in Node text.
    await selectNodeAndFocusBox("B_A", "nodeTextInput");
    await send("Input.insertText", { text: "One" });
    await pressShiftEnter();
    await send("Input.insertText", { text: "Two" });
    assert.equal(await executeExpression("document.getElementById('nodeTextInput').value"), "One\nTwo");
    assert.ok((await getSourceLines()).includes('  B_A["Alpha"]'));
});

test("test_enter_writes_the_line_break_as_br_on_one_source_line", async () => {
    await selectNodeAndFocusBox("B_A", "nodeTextInput");
    await send("Input.insertText", { text: "One" });
    await pressShiftEnter();
    await send("Input.insertText", { text: "Two" });
    await pressEnterAndWaitForWrite();
    assert.ok((await getSourceLines()).includes('  B_A["One<br/>Two"]'));
    assert.equal(await executeExpression("document.getElementById('error').textContent"), "");
    assert.equal(await executeExpression(`document.querySelectorAll('#diagram [id*="flowchart-B_A-"] br').length`), 1);
});

test("test_node_text_box_shows_br_as_a_line_break_and_a_second_edit_does_not_double_it", async () => {
    await selectNodeAndFocusBox("B_A", "nodeTextInput");
    await send("Input.insertText", { text: "One" });
    await pressShiftEnter();
    await send("Input.insertText", { text: "Two" });
    await pressEnterAndWaitForWrite();
    // Step: select another node, then select B_A again.
    await clickNodeWithMouse("B_B");
    await clickNodeWithMouse("B_A");
    // await waitMilliseconds(300);
    assert.equal(await executeExpression("document.getElementById('nodeTextInput').value"), "One\nTwo");
    // Step: add "!" at the end and write.
    await executeExpression("(() => { const box = document.getElementById('nodeTextInput'); box.focus(); box.setSelectionRange(box.value.length, box.value.length); })()");
    await send("Input.insertText", { text: "!" });
    await pressEnterAndWaitForWrite();
    const lines = await getSourceLines();
    assert.ok(lines.includes('  B_A["One<br/>Two!"]'), lines.join("|"));
    assert.equal((lines.join("\n").match(/<br\/>/g) ?? []).length, 1);
});

test("test_pasted_text_with_line_breaks_is_written_with_br", async () => {
    await selectNodeAndFocusBox("B_A", "nodeTextInput");
    await send("Input.insertText", { text: "Red\nBlue" });
    await pressEnterAndWaitForWrite();
    const lines = await getSourceLines();
    assert.ok(lines.includes('  B_A["Red<br/>Blue"]'), lines.join("|"));
});

test("test_shift_enter_in_notes_adds_a_line_break_and_does_not_write", async () => {
    await selectNodeAndFocusBox("B_A", "nodeNotesInput");
    await send("Input.insertText", { text: "One" });
    await pressShiftEnter();
    await send("Input.insertText", { text: "Two" });
    assert.equal(await executeExpression("document.getElementById('nodeNotesInput').value"), "One\nTwo");
    assert.ok(!(await getSourceLines()).some((line) => line.includes("==props==")));
});

test("test_enter_in_notes_writes_the_note_as_one_line_with_br", async () => {
    await selectNodeAndFocusBox("B_A", "nodeNotesInput");
    await send("Input.insertText", { text: "One" });
    await pressShiftEnter();
    await send("Input.insertText", { text: "Two" });
    await pressEnterAndWaitForWrite();
    const lines = await getSourceLines();
    const noteLines = lines.filter((line) => line.includes("==props=="));
    assert.deepEqual(noteLines, ['  %% ==props==: {"blockId":"B_A","note":"One<br/>Two"}']);
    assert.equal(lines[lines.indexOf(noteLines[0]) + 1], '  B_A["Alpha"]');
    assert.equal(await executeExpression("document.getElementById('nodeNotesInput').value"), "One\nTwo");
});

test("test_notes_box_shows_br_as_a_line_break_after_reselecting_and_a_second_edit_does_not_double_it", async () => {
    await selectNodeAndFocusBox("B_A", "nodeNotesInput");
    await send("Input.insertText", { text: "One" });
    await pressShiftEnter();
    await send("Input.insertText", { text: "Two" });
    await pressEnterAndWaitForWrite();
    await clickNodeWithMouse("B_B");
    await clickNodeWithMouse("B_A");
    // await waitMilliseconds(300);
    assert.equal(await executeExpression("document.getElementById('nodeNotesInput').value"), "One\nTwo");
    await executeExpression("(() => { const box = document.getElementById('nodeNotesInput'); box.focus(); box.setSelectionRange(box.value.length, box.value.length); })()");
    await send("Input.insertText", { text: "!" });
    await pressEnterAndWaitForWrite();
    const noteLines = (await getSourceLines()).filter((line) => line.includes("==props=="));
    assert.deepEqual(noteLines, ['  %% ==props==: {"blockId":"B_A","note":"One<br/>Two!"}']);
});

test("test_pasted_text_with_line_breaks_in_notes_is_written_with_br", async () => {
    await selectNodeAndFocusBox("B_A", "nodeNotesInput");
    await send("Input.insertText", { text: "Red\nBlue" });
    await pressEnterAndWaitForWrite();
    const noteLines = (await getSourceLines()).filter((line) => line.includes("==props=="));
    assert.deepEqual(noteLines, ['  %% ==props==: {"blockId":"B_A","note":"Red<br/>Blue"}']);
});

test("test_each_text_box_has_one_tiny_helper_line_below_it", async () => {
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    // await waitMilliseconds(500);
    await clickNodeWithMouse("B_A");
    // await waitMilliseconds(300);
    // const measured = JSON.parse(await executeExpression(`JSON.stringify((() => {
    type Hint = { text: string; fontSize: number; gapBelowBox: number; leftOffset: number; hintHeight: number };
    const measured: { labelFont: number; text: Hint; notes: Hint } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const labelFont = parseFloat(getComputedStyle(document.querySelector('#nodeTextInput').closest('label').querySelector('span')).fontSize);
        const read = (boxId, hintId) => {
            const box = document.getElementById(boxId).getBoundingClientRect();
            const hint = document.getElementById(hintId);
            const hintBox = hint.getBoundingClientRect();
            return { text: hint.textContent, fontSize: parseFloat(getComputedStyle(hint).fontSize), gapBelowBox: hintBox.top - box.bottom, leftOffset: hintBox.left - box.left, hintHeight: hintBox.height };
        };
        return { labelFont, text: read('nodeTextInput', 'nodeTextHint'), notes: read('nodeNotesInput', 'nodeNotesHint') };
    })())`));
    console.log(`MEASURED hints: ${JSON.stringify(measured)}`);
    for (const hint of [measured.text, measured.notes]) {
        assert.equal(hint.text, "shift-enter: new line");
        assert.ok(hint.fontSize < measured.labelFont, `hint font ${hint.fontSize}px, label font ${measured.labelFont}px`);
        assert.ok(hint.fontSize <= 11);
        assert.ok(hint.gapBelowBox >= 0 && hint.gapBelowBox <= 8, `gap ${hint.gapBelowBox}px`);
        assert.ok(hint.hintHeight <= 16, `hint height ${hint.hintHeight}px`);
    }
});
