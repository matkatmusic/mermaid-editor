import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { evaluate, send } from "./cdp.ts";
import { clickNode, openEditorDrawer, resetEditorFixture } from "./editor-helpers.ts";
import { inspectorState } from "./inspector-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test("test_node_text_tab_writes_text", async () => {
  await resetEditorFixture();
  // Step: click the Q1 question node, type a new label into the Text input, and press Tab.
  await clickNode("Q_Q1");
  await evaluate("(() => { const input = document.getElementById('nodeTextInput'); input.value = 'Can I breathe?'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })); })()");
  await evaluate("window.editorActionPromise");
  // Step: the diagram source has the new text.
  const source = await evaluate("codeBox.value");
  assert.ok(source.includes('Q_Q1{"Can I breathe?"}'));
});

test("test_node_text_click_away_writes_text_and_keeps_clicked_node_selected", async () => {
  await resetEditorFixture();
  // Step: select Q1, then type a new label into the Text input as a user would.
  await clickNode("Q_Q1");
  await evaluate("(() => { const input = document.getElementById('nodeTextInput'); input.focus(); input.select(); })()");
  await send("Input.insertText", { text: "Can I pause?" });
  // Step: click the LetGo block node with a real mouse click, which blurs the Text input.
  const point = JSON.parse(await evaluate("JSON.stringify((() => { const el = document.querySelector('[id*=\"flowchart-B_LetGo-\"]'); el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })())"));
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await evaluate("window.editorActionPromise");
  // Step: the source has Q1's new text, and the clicked node is the selected one.
  const source = await evaluate("codeBox.value");
  assert.ok(source.includes('Q_Q1{"Can I pause?"}'));
  const inspector = await inspectorState();
  assert.equal(inspector.title, "static block");
  assert.equal(inspector.text, "Let it go");
});
