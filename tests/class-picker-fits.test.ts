import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, selectEditorNode, setEditorSource } from "./editor-helpers.ts";
import { SEARCH_FIXTURE } from "./fixtures.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const CLASS_COUNT = 14;

async function openClassPickerWithManyClasses() {
    await resetEditorFixture();
    const classLines = Array.from({ length: CLASS_COUNT }, (_, index) => `  classDef cls${index} fill:#cfc,stroke:#393`);
    await setEditorSource(`${SEARCH_FIXTURE}\n${classLines.join("\n")}`);
    await selectEditorNode("B_MIDDLE");
    await executeExpression("document.getElementById('classPickerBtn').click()");
    await waitMilliseconds(200);
}

// async function measureClassPickerList() {
async function measureClassPickerList(): Promise<{ listTop: number; listBottom: number; scrollHeight: number; clientHeight: number; rows: { text: string; top: number; bottom: number }[]; windowHeight: number }> {
    // return JSON.parse(await executeExpression(`JSON.stringify((() => {
    return JSON.parse(await executeExpression<string>(`JSON.stringify((() => {
        const list = document.getElementById('classPickerList');
        const listRect = list.getBoundingClientRect();
        const rows = [...list.querySelectorAll('.class-picker-row')].map((row) => { const rect = row.getBoundingClientRect(); return { text: row.textContent.trim(), top: rect.top, bottom: rect.bottom }; });
        return { listTop: listRect.top, listBottom: listRect.bottom, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight, rows, windowHeight: window.innerHeight };
    })())`));
}

test("test_class_picker_popup_shows_every_option_without_a_scroll", async () => {
    // Step: select a block in a diagram with 14 classes and open the class picker.
    await openClassPickerWithManyClasses();
    const measured = await measureClassPickerList();
    // Step: the list has at least the 14 classes plus "(none)" and "new...".
    assert.ok(measured.rows.length >= CLASS_COUNT + 2, `rows: ${measured.rows.length}`);
    // Step: the list has nothing to scroll, and every row is inside the list and inside the window.
    assert.ok(measured.scrollHeight <= measured.clientHeight + 1, `scroll height ${measured.scrollHeight}px, visible height ${measured.clientHeight}px`);
    for (const row of measured.rows) {
        assert.ok(row.top >= measured.listTop - 1 && row.bottom <= measured.listBottom + 1, `row "${row.text}" ${row.top}-${row.bottom}px, list ${measured.listTop}-${measured.listBottom}px`);
        assert.ok(row.top >= 0 && row.bottom <= measured.windowHeight, `row "${row.text}" is outside the window of ${measured.windowHeight}px`);
    }
});

test("test_class_picker_popup_stays_inside_a_window_that_is_shorter_than_the_list", async () => {
    // Step: shrink the window so that the 14 classes cannot all show.
    await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 400, deviceScaleFactor: 1, mobile: false });
    try {
        await openClassPickerWithManyClasses();
        const measured = await measureClassPickerList();
        // Step: the list is inside the window, and it scrolls because it is taller than the window.
        assert.ok(measured.listTop >= 0, `list top ${measured.listTop}px`);
        assert.ok(measured.listBottom <= measured.windowHeight, `list bottom ${measured.listBottom}px, window ${measured.windowHeight}px`);
    }
    finally {
        await send("Emulation.clearDeviceMetricsOverride", {});
    }
});
