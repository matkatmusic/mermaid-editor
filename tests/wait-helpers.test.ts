import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeAndWaitForRender, executeAndWaitForScrollEnd, executeExpression, waitForEditorAction, waitForExpression, waitForRender, waitForTwoFrames } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

// const TALL_SOURCE = ["flowchart TD", ...Array.from({ length: 40 }, (_unused, index) => `  N${index} --> N${index + 1}`)].join("\n");
const TALL_SOURCE = ["flowchart TD", ...Array.from({ length: 41 }, (_unused, index) => `  B_N${index}[Step ${index}]`), ...Array.from({ length: 40 }, (_unused, index) => `  B_N${index} --> B_N${index + 1}`)].join("\n");

async function loadTallDiagram() {
    await resetEditorFixture();
    await setEditorSource(TALL_SOURCE);
    await executeExpression("document.querySelector('#output').scrollTop = 0");
    await waitForTwoFrames();
}

test("test_waitForExpression_returns_when_the_page_value_becomes_true", async () => {
    // The page value is false now. A page timer sets it true after 100 ms.
    await executeExpression("window.ready = false; setTimeout(() => { window.ready = true; }, 100); true");
    await waitForExpression("window.ready");
    assert.equal(await executeExpression("window.ready"), true);
});

test("test_waitForExpression_throws_with_the_expression_after_the_timeout", async () => {
    await assert.rejects(waitForExpression("false", 100), /false did not become true within 100ms/);
});

test("test_executeAndWaitForRender_returns_after_the_new_drawing_is_on_screen", async () => {
    await resetEditorFixture();
    await waitForRender();
    const svgIdBefore = await executeExpression<string>("document.querySelector('#diagram svg').id");
    // The action edits the source and starts a drawing without waiting for it.
    // await executeAndWaitForRender(() => executeExpression("codeBox.value = 'flowchart TD\\n  A[One] --> B[Two]'; render(); true"));
    await executeAndWaitForRender(() => executeExpression("codeBox.value = 'flowchart TD\\n  B_ONE[One]\\n  B_TWO[Two]\\n  B_ONE --> B_TWO'; render(); true"));
    const svgIdAfter = await executeExpression<string>("document.querySelector('#diagram svg').id");
    assert.notEqual(svgIdAfter, svgIdBefore);
});

test("test_executeAndWaitForRender_throws_when_the_action_starts_no_render", async () => {
    await waitForRender();
    await assert.rejects(executeAndWaitForRender(async () => {}, 100), /did not become true within 100ms/);
});

test("test_executeAndWaitForScrollEnd_returns_after_a_smooth_scroll_stops", async () => {
    await loadTallDiagram();
    await executeAndWaitForScrollEnd("#output", () => executeExpression("document.querySelector('#output').scrollTo({ top: 400, behavior: 'smooth' }); true"));
    assert.equal(await executeExpression("document.querySelector('#output').scrollTop"), 400);
});

test("test_executeAndWaitForScrollEnd_throws_when_nothing_scrolls", async () => {
    await assert.rejects(executeAndWaitForScrollEnd("#output", async () => {}, 100), /did not become true within 100ms/);
});

test("test_waitForEditorAction_returns_after_the_promise_settles", async () => {
    await executeExpression("window.done = false; window.editorActionPromise = new Promise((resolve) => setTimeout(() => { window.done = true; resolve(); }, 100)); true");
    await waitForEditorAction();
    assert.equal(await executeExpression("window.done"), true);
});

test("test_waitForEditorAction_throws_when_the_promise_rejects", async () => {
    await executeExpression("window.editorActionPromise = Promise.reject(new Error('boom')); window.editorActionPromise.catch(() => {}); true");
    await assert.rejects(waitForEditorAction(), /editor action failed: Error: boom/);
});

test("test_waitForTwoFrames_lets_a_scroll_listener_run", async () => {
    await loadTallDiagram();
    await executeExpression("window.sawScroll = false; document.querySelector('#output').addEventListener('scroll', () => { window.sawScroll = true; }, { once: true }); document.querySelector('#output').scrollTop = 100; true");
    await waitForTwoFrames();
    assert.equal(await executeExpression("window.sawScroll"), true);
});
