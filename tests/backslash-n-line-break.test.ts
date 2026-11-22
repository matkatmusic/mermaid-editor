import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse, KeyName, pressKey } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

// The label holds a literal backslash and the letter n, as the user types it in the file.
const FIRST_LINE = "if (i < puzzle.size())";
const SECOND_LINE = "Is there a pair of the original puzzle left to look at?";
const LABEL = `${FIRST_LINE}\\n${SECOND_LINE}`;

const BLOCK_SOURCE = `flowchart TD\n  B_A["${LABEL}"]\n  B_B["Next"]\n  B_A --> B_B`;
const DECISION_SOURCE = [
    "flowchart TD",
    `  Q_ASK{"${LABEL}"}`,
    `  Q_CHOICE_ASK_YES["Yes\\nSure"]`,
    `  Q_CHOICE_ASK_NO["No\\nNever"]`,
    '  B_END["End"]',
    "  Q_ASK --> Q_CHOICE_ASK_YES --> B_END",
    "  Q_ASK --> Q_CHOICE_ASK_NO --> B_END",
].join("\n");

async function loadSource(source: string) {
    await resetEditorFixture();
    await setEditorSource(source);
    await waitMilliseconds(500);
}

test("test_phone_block_row_draws_a_literal_backslash_n_as_a_line_break", async () => {
    await loadSource(BLOCK_SOURCE);
    await clickNodeWithMouse("B_B");
    await waitMilliseconds(500);
    const phone = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const block = document.querySelector('#phoneDiagram [data-node-id="B_A"]');
        return { breaks: block.querySelectorAll('br').length, lines: block.innerText.split('\\n'), text: block.textContent };
    })())`));
    assert.equal(phone.breaks, 1);
    assert.deepEqual(phone.lines, [FIRST_LINE, SECOND_LINE]);
    assert.ok(!phone.text.includes("\\n"));
});

test("test_phone_question_row_and_choice_buttons_draw_a_literal_backslash_n_as_a_line_break", async () => {
    await loadSource(DECISION_SOURCE);
    await clickNodeWithMouse("Q_ASK");
    await waitMilliseconds(500);
    const phone = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const question = document.querySelector('#phoneDiagram .phone-question');
        const buttons = [...document.querySelectorAll('#phoneDiagram .phone-choice')];
        return { questionBreaks: question.querySelectorAll('br').length, questionLines: question.innerText.split('\\n'), buttonBreaks: buttons.map((button) => button.querySelectorAll('br').length), buttonLines: buttons.map((button) => button.innerText.split('\\n')) };
    })())`));
    assert.equal(phone.questionBreaks, 1);
    assert.deepEqual(phone.questionLines, [FIRST_LINE, SECOND_LINE]);
    assert.deepEqual(phone.buttonBreaks, [1, 1]);
    assert.deepEqual(phone.buttonLines.sort(), [["No", "Never"], ["Yes", "Sure"]]);
});

test("test_destination_list_and_walk_back_window_show_a_literal_backslash_n_as_a_space", async () => {
    await loadSource(DECISION_SOURCE);
    await clickNodeWithMouse("B_END");
    await waitMilliseconds(300);
    const optionTexts: string[] = JSON.parse(await executeExpression("JSON.stringify([...document.querySelectorAll('#destinationSelect option')].map((option) => option.textContent))"));
    assert.ok(optionTexts.includes(`${FIRST_LINE} ${SECOND_LINE} (Q_ASK)`), optionTexts.join("|"));
    await executeExpression("document.getElementById('walkBackBtn').click()");
    const buttonTexts: string[] = JSON.parse(await executeExpression("JSON.stringify([...document.querySelectorAll('#walkBackChoices button')].map((button) => button.textContent))"));
    await executeExpression("document.getElementById('walkBackCancelBtn').click()");
    assert.deepEqual(buttonTexts.sort(), ["No Never", "Yes Sure"]);
});

test("test_node_text_box_shows_a_literal_backslash_n_as_a_line_break", async () => {
    await loadSource(BLOCK_SOURCE);
    await clickNodeWithMouse("B_A");
    await waitMilliseconds(300);
    assert.equal(await executeExpression("document.getElementById('nodeTextInput').value"), `${FIRST_LINE}\n${SECOND_LINE}`);
});

test("test_enter_without_a_change_leaves_a_literal_backslash_n_in_the_file", async () => {
    await loadSource(BLOCK_SOURCE);
    await clickNodeWithMouse("B_A");
    await waitMilliseconds(300);
    const before = await executeExpression("codeBox.value");
    await executeExpression("document.getElementById('nodeTextInput').focus()");
    await pressKey(KeyName.Enter);
    await executeExpression("window.editorActionPromise");
    await waitMilliseconds(500);
    assert.equal(await executeExpression("codeBox.value"), before);
});

test("test_an_edit_writes_the_line_break_back_as_backslash_n_not_br", async () => {
    await loadSource(BLOCK_SOURCE);
    await clickNodeWithMouse("B_A");
    await waitMilliseconds(300);
    await executeExpression("(() => { const box = document.getElementById('nodeTextInput'); box.focus(); box.setSelectionRange(box.value.length, box.value.length); })()");
    await send("Input.insertText", { text: "!" });
    await pressKey(KeyName.Enter);
    await executeExpression("window.editorActionPromise");
    await waitMilliseconds(500);
    const lines: string[] = (await executeExpression("codeBox.value")).split("\n");
    assert.ok(lines.includes(`  B_A["${LABEL}!"]`), lines.join("|"));
});
