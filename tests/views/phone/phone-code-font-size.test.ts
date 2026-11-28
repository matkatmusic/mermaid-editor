import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression, waitMilliseconds } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse } from "../../real-input.ts";
registerBrowserHooks(import.meta.url, openEditorDrawer);
const TICK = "#96;";
const FENCE = "#96;#96;#96;";
const SOURCE = [
    "flowchart TD",
    `  B_ONE["Run ${TICK}go()${TICK} first"]`,
    `  Q_ONE{"Is ${TICK}a${TICK} set?"}`,
    `  Q_CHOICE_ONE_Y["Yes ${TICK}y${TICK}"]`,
    '  Q_CHOICE_ONE_N["No"]',
    `  B_TWO["Then ${TICK}b()${TICK}<br/>${FENCE}<br/>line one<br/>${FENCE}"]`,
    `  Q_TWO{"Really ${TICK}c${TICK}?"}`,
    `  Q_CHOICE_TWO_Y["Yes ${TICK}z${TICK}"]`,
    '  Q_CHOICE_TWO_N["No"]',
    "  B_ONE --> Q_ONE",
    "  Q_ONE --> Q_CHOICE_ONE_Y --> B_TWO --> Q_TWO",
    "  Q_ONE --> Q_CHOICE_ONE_N",
    "  Q_TWO --> Q_CHOICE_TWO_Y",
    "  Q_TWO --> Q_CHOICE_TWO_N",
].join("\n");
// type FontSizes = Record<string, number | null>;
type FontSizes = Record<"pickedButton" | "pickedButtonCode" | "activeQuestion" | "activeQuestionCode" | "pastQuestionCode" | "activeChoiceButton" | "activeChoiceButtonCode" | "block" | "blockSpanCode" | "blockCodeBlock", number | null>;
async function loadPhoneWithActiveSecondQuestion() {
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    // await waitMilliseconds(600);
    await clickNodeWithMouse("Q_TWO");
    // await waitMilliseconds(600);
}
async function readFontSizes(): Promise<FontSizes> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const sizeOf = (selector) => {
            const element = document.querySelector('#phoneDiagram ' + selector);
            return element ? Number.parseFloat(getComputedStyle(element).fontSize) : null;
        };
        return {
            pickedButton: sizeOf('.phone-choice-chosen'),
            pickedButtonCode: sizeOf('.phone-choice-chosen code'),
            activeQuestion: sizeOf('[data-active-question]'),
            activeQuestionCode: sizeOf('[data-active-question] code'),
            pastQuestionCode: sizeOf('.phone-decision-past .phone-question code'),
            activeChoiceButton: sizeOf('.phone-decision:not(.phone-decision-past) .phone-choice'),
            activeChoiceButtonCode: sizeOf('.phone-decision:not(.phone-decision-past) .phone-choice code'),
            block: sizeOf('.phone-block'),
            blockSpanCode: sizeOf('.phone-block code'),
            blockCodeBlock: sizeOf('.phone-block .phone-code-block'),
        };
    })())`));
}
test("test_phone_code_text_has_the_font_size_of_a_picked_choice_button_in_every_kind_of_row", async () => {
    await loadPhoneWithActiveSecondQuestion();
    const sizes = await readFontSizes();
    console.log(`MEASURED phone font sizes: ${JSON.stringify(sizes)}`);
    for (const [name, size] of Object.entries(sizes))
        assert.notEqual(size, null, `${name} not found: ${JSON.stringify(sizes)}`);
    // for (const name of ["pickedButtonCode", "activeQuestionCode", "pastQuestionCode", "activeChoiceButtonCode", "blockSpanCode", "blockCodeBlock"])
    for (const name of ["pickedButtonCode", "activeQuestionCode", "pastQuestionCode", "activeChoiceButtonCode", "blockSpanCode", "blockCodeBlock"] as const)
        assert.equal(sizes[name], sizes.pickedButton, `${name}: ${JSON.stringify(sizes)}`);
});
test("test_the_picked_button_code_size_is_smaller_than_the_regular_text_of_the_active_question", async () => {
    await loadPhoneWithActiveSecondQuestion();
    const sizes = await readFontSizes();
    assert.ok(sizes.pickedButton! < sizes.activeQuestion!, JSON.stringify(sizes));
});
test("test_phone_regular_text_keeps_its_present_font_sizes", async () => {
    await loadPhoneWithActiveSecondQuestion();
    const sizes = await readFontSizes();
    assert.equal(sizes.pickedButton, 13, JSON.stringify(sizes));
    assert.equal(sizes.activeQuestion, 20, JSON.stringify(sizes));
    assert.equal(sizes.activeChoiceButton, 17, JSON.stringify(sizes));
    assert.equal(sizes.block, 14, JSON.stringify(sizes));
});
test("test_the_main_diagram_code_font_size_does_not_change", async () => {
    await loadPhoneWithActiveSecondQuestion();
    const size = Number.parseFloat(await executeExpression(`getComputedStyle(document.querySelector('#diagram g.node[id*="flowchart-B_ONE-"] code')).fontSize`));
    assert.equal(size, 16);
});
