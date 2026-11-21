import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const SOURCE = 'flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_A --> B_B';
// Measured with the old padding (6px 10px) before task 67 changed it.
const HEIGHT_BEFORE_TASK_67 = 31;
const FONT_SIZE_BEFORE_TASK_67 = 13.3333;

test("test_inspector_buttons_are_twenty_to_twenty_five_percent_shorter_and_keep_the_font_size", async () => {
    // Scenario: select a static block; its action buttons show in the inspector.
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    await waitMilliseconds(500);
    await clickNodeWithMouse("B_A");
    await waitMilliseconds(300);
    const measured = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const buttons = [...document.querySelectorAll('#nodeInspectorActions button')];
        const walkBack = document.getElementById('walkBackBtn');
        return { count: buttons.length, heights: buttons.map((button) => button.getBoundingClientRect().height), fontSizes: buttons.map((button) => parseFloat(getComputedStyle(button).fontSize)), walkBackHeight: walkBack.getBoundingClientRect().height };
    })())`));
    console.log(`MEASURED button height: ${JSON.stringify(measured)}`);
    assert.ok(measured.count > 0);
    for (const height of [...measured.heights, measured.walkBackHeight]) {
        const ratio = height / HEIGHT_BEFORE_TASK_67;
        assert.ok(ratio >= 0.75 && ratio <= 0.80, `height ${height}px against ${HEIGHT_BEFORE_TASK_67}px before`);
    }
    for (const fontSize of measured.fontSizes)
        assert.equal(fontSize, FONT_SIZE_BEFORE_TASK_67);
});
