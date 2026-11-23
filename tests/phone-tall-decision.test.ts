import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitForRender } from "./cdp.ts";
import { resetEditorFixture, setEditorSource } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url);

const SHORT_WINDOW_HEIGHT = 400;
const NORMAL_WINDOW_HEIGHT = 1000;

async function setWindowHeight(height: number) {
    await send("Emulation.setDeviceMetricsOverride", { width: 1500, height, deviceScaleFactor: 1, mobile: false });
}

// Reports where the phone screen, the footer and the choices are. The phone frame has overflow:hidden, so only the footer's own scrollbar can reach a clipped choice.
async function measureChoicesAfterScrollingIntoView(questionText: string) {
    await resetEditorFixture();
    await setEditorSource(`flowchart TD\n  Q_FIRST{"${questionText}"}\n  Q_CHOICE_FIRST_A["A"]\n  Q_CHOICE_FIRST_B["B"]\n  Q_FIRST --> Q_CHOICE_FIRST_A\n  Q_FIRST --> Q_CHOICE_FIRST_B`);
    await waitForRender();
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const choiceElements = Array.from(document.querySelectorAll('#phoneDiagram [data-active-question] ~ .phone-choice-row .phone-choice'));
        const phone = document.getElementById('phoneOutput').getBoundingClientRect();
        const footer = document.getElementById('phoneFooter');
        return {
            phoneTop: phone.top,
            phoneBottom: phone.bottom,
            footerBottom: footer.getBoundingClientRect().bottom,
            footerOverflowY: getComputedStyle(footer).overflowY,
            footerScrollHeight: footer.scrollHeight,
            footerClientHeight: footer.clientHeight,
            choices: choiceElements.map(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; }),
        };
    })())`));
}

function assertChoicesInsidePhone(measured: { phoneTop: number; phoneBottom: number; choices: { top: number; bottom: number; height: number }[] }) {
    assert.equal(measured.choices.length, 2, JSON.stringify(measured));
    for (const choice of measured.choices) {
        assert.ok(choice.height > 0, JSON.stringify(measured));
        assert.ok(choice.top >= measured.phoneTop, JSON.stringify(measured));
        assert.ok(choice.bottom <= measured.phoneBottom, JSON.stringify(measured));
    }
}

test("test_phone_shows_both_choices_when_decision_text_has_3_lines", async () => {
    // Step: normal window, a decision with 3 lines separated by <br/> and 2 choices.
    await setWindowHeight(NORMAL_WINDOW_HEIGHT);
    const measured = await measureChoicesAfterScrollingIntoView("one<br/>two<br/>three");
    // Step: both choices are present, have size, and sit inside the phone screen.
    assertChoicesInsidePhone(measured);
});

test("test_phone_shows_both_choices_when_decision_text_has_4_lines_with_br_tags", async () => {
    // Step: normal window, the same decision with 4 lines separated by <br/>.
    await setWindowHeight(NORMAL_WINDOW_HEIGHT);
    const measured = await measureChoicesAfterScrollingIntoView("one<br/>two<br/>three<br/>four");
    // Step: both choices are present, have size, and sit inside the phone screen.
    assertChoicesInsidePhone(measured);
});

test("test_phone_shows_both_choices_when_decision_text_has_4_lines_with_backslash_n", async () => {
    // Step: normal window, the same decision with 4 lines separated by a literal \n.
    await setWindowHeight(NORMAL_WINDOW_HEIGHT);
    const measured = await measureChoicesAfterScrollingIntoView("one\\ntwo\\nthree\\nfour");
    // Step: both choices are present, have size, and sit inside the phone screen.
    assertChoicesInsidePhone(measured);
});

test("test_phone_can_scroll_to_both_choices_when_a_4_line_decision_is_taller_than_the_phone_screen", async () => {
    // Step: a short window makes the phone screen shorter than a 4-line decision plus its choices.
    await setWindowHeight(SHORT_WINDOW_HEIGHT);
    const measured = await measureChoicesAfterScrollingIntoView("Line number 1 of text<br/>Line number 2 of text<br/>Line number 3 of text<br/>Line number 4 of text");
    // Step: put the window back to its normal size before asserting, so a failure does not leak into later tests.
    await setWindowHeight(NORMAL_WINDOW_HEIGHT);
    // Step: the footer stays inside the phone screen and scrolls by itself, so the user can reach both choices.
    assert.ok(measured.footerBottom <= measured.phoneBottom, JSON.stringify(measured));
    assert.equal(measured.footerOverflowY, "auto", JSON.stringify(measured));
    assert.ok(measured.footerScrollHeight > measured.footerClientHeight, JSON.stringify(measured));
    assert.equal(measured.choices.length, 2, JSON.stringify(measured));
});

test("test_phone_restores_the_accountability_diagram_after_tall_decision_tests", async () => {
    await executeExpression("loadDiagram('accountability.mmd')");
    await waitForRender();
});
