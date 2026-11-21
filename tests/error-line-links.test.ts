import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitForRender } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

// 60 valid blocks, then a bad prefix on the last line (line 62), so the bad line is far below the first screen.
const declarations = Array.from({ length: 60 }, (_, index) => `  B_N${index}["N${index}"]`);
const SOURCE_WITH_BAD_LAST_LINE = ["flowchart TD", ...declarations, '  X_Bad["Bad"]'].join("\n");
const BAD_LINE_NUMBER = 62;

async function startErrorLinkTest() {
  await resetEditorFixture();
  await setEditorSource(SOURCE_WITH_BAD_LAST_LINE);
  await executeExpression("codeBox.scrollTop = 0; codeBox.blur()");
}

async function clickLinkWithMouse(containerId: string) {
  const center = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const rect = document.querySelector('#${containerId} button[data-line="${BAD_LINE_NUMBER}"]').getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })())`));
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount: 1 });
  await waitForRender();
}

async function readSourceSelection() {
  return JSON.parse(await executeExpression(`JSON.stringify({
    activeId: document.activeElement.id,
    selectedText: codeBox.value.slice(codeBox.selectionStart, codeBox.selectionEnd),
    lineText: codeBox.value.split('\\n')[${BAD_LINE_NUMBER - 1}],
    isDrawerOpen: !document.getElementById('drawer').classList.contains('closed'),
    scrollTop: codeBox.scrollTop,
  })`));
}

test("test_error_box_shows_the_line_number_as_a_button", async () => {
  await startErrorLinkTest();
  const label = await executeExpression(`document.querySelector('#error button[data-line="${BAD_LINE_NUMBER}"]').textContent`);
  assert.equal(label, `Line ${BAD_LINE_NUMBER}`);
});

test("test_clicking_a_line_link_in_the_error_log_focuses_the_source_editor_and_selects_that_line", async () => {
  await startErrorLinkTest();
  await clickLinkWithMouse("errorLog");
  const selection = await readSourceSelection();
  assert.equal(selection.activeId, "code");
  assert.equal(selection.selectedText, selection.lineText);
});

test("test_clicking_a_line_link_scrolls_the_source_editor_to_that_line", async () => {
  await startErrorLinkTest();
  await clickLinkWithMouse("errorLog");
  const selection = await readSourceSelection();
  assert.ok(selection.scrollTop > 0);
});

test("test_a_line_link_opens_the_editor_drawer_when_it_is_closed", async () => {
  await startErrorLinkTest();
  await executeExpression("document.getElementById('drawer').classList.add('closed')");
  await executeExpression(`document.querySelector('#error button[data-line="${BAD_LINE_NUMBER}"]').click()`);
  const selection = await readSourceSelection();
  assert.equal(selection.isDrawerOpen, true);
  assert.equal(selection.selectedText, selection.lineText);
});

test("test_error_text_is_not_read_as_html", async () => {
  // Scenario: an id with markup characters must not become elements in the error box.
  await resetEditorFixture();
  await setEditorSource('flowchart TD\n  B_A["a"]\n  B_A --> B_Missing');
  const childTags = await executeExpression("[...document.getElementById('error').children].map((el) => el.tagName).join(',')");
  assert.equal(childTags, "BUTTON");
});
