import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression, waitMilliseconds } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse } from "../../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

// B_START shows a quote; B_MID shows the three <br> forms; the decision leads to B_END.
const SOURCE = [
    "flowchart TD",
    '  B_START["Say #quot;hi#quot;"]',
    '  Q_ASK{"Ask?"}',
    '  Q_CHOICE_ASK_YES["Yes #quot;sure#quot;"]',
    '  Q_CHOICE_ASK_NO["No #quot;never#quot;"]',
    '  B_MID["One<br>Two<br/>Three<br />Four"]',
    "  B_START --> Q_ASK",
    "  Q_ASK --> Q_CHOICE_ASK_YES --> B_MID",
    "  Q_ASK --> Q_CHOICE_ASK_NO --> B_MID",
].join("\n");

async function startDisplayTest() {
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    // await waitMilliseconds(500);
}

test("test_destination_list_shows_quot_entity_as_a_quote_and_br_forms_as_a_space", async () => {
    await startDisplayTest();
    await clickNodeWithMouse("Q_CHOICE_ASK_YES");
    // await waitMilliseconds(300);
    const optionTexts: string[] = JSON.parse(await executeExpression("JSON.stringify([...document.querySelectorAll('#destinationSelect option')].map((option) => option.textContent))"));
    assert.ok(optionTexts.includes('Say "hi" (B_START)'), optionTexts.join("|"));
    assert.ok(optionTexts.includes("One Two Three Four (B_MID)"), optionTexts.join("|"));
});

test("test_walk_back_window_shows_quot_entity_as_a_quote_and_br_forms_as_a_space", async () => {
    await startDisplayTest();
    // Step: B_MID has two parents, the Yes choice and the No choice, so Walk back asks which one.
    await clickNodeWithMouse("B_MID");
    // await waitMilliseconds(300);
    await executeExpression("document.getElementById('walkBackBtn').click()");
    const buttonTexts: string[] = JSON.parse(await executeExpression("JSON.stringify([...document.querySelectorAll('#walkBackChoices button')].map((button) => button.textContent))"));
    await executeExpression("document.getElementById('walkBackCancelBtn').click()");
    assert.deepEqual(buttonTexts.sort(), ['No "never"', 'Yes "sure"']);
});

test("test_phone_view_shows_quot_entity_as_a_quote_and_every_br_form_as_a_line_break", async () => {
    await resetEditorFixture();
    await setEditorSource(['flowchart TD', '  B_START["Say #quot;hi#quot;"]', '  B_MID["One<br>Two<br/>Three<br />Four"]', '  B_START --> B_MID'].join("\n"));
    // await waitMilliseconds(500);
    // Step: a click on B_MID makes the phone show the path to it, with B_MID as the last block.
    await clickNodeWithMouse("B_MID");
    // await waitMilliseconds(500);
    // const phone = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const phone: { breaks: number; blockText: string; startText: string } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const block = document.querySelector('#phoneDiagram [data-node-id="B_MID"]');
        const start = document.querySelector('#phoneDiagram [data-node-id="B_START"]');
        return { breaks: block.querySelectorAll('br').length, blockText: block.innerText, startText: start.textContent };
    })())`));
    assert.equal(phone.breaks, 3);
    assert.equal(phone.blockText.split("\n").length, 4);
    assert.equal(phone.startText, 'Say "hi"');
});
