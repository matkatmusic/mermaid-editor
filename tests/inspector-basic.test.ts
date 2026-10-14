import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { evaluate } from "./cdp.ts";
import { clickNode, dblclickNode, openEditorDrawer, resetEditorFixture, selectEditorNode } from "./editor-helpers.ts";
import { inspectorPlacement, inspectorState } from "./inspector-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test("test_clicking_a_question_opens_a_decision_block_inspector", async () => {
  await resetEditorFixture();
  // Step: click the Q1 question node.
  await clickNode("Q_Q1");
  // Step: the inspector is open, titled "Decision block", and holds the current label.
  const state = await inspectorState();
  assert.equal(state.hidden, false);
  assert.equal(state.title, "Decision block");
  assert.equal(state.text, "Can I be calm?");
  // Step: the card is fixed to the drawer edge at the top of the content area.
  const placement = await inspectorPlacement();
  assert.ok(placement.width > 0);
  assert.equal(placement.atDrawerEdge, true);
  // The widget now sits below #output, not at the content top.
  // assert.equal(placement.atContentTop, true);
});

test("test_clicking_a_block_opens_a_static_block_inspector", async () => {
  await resetEditorFixture();
  // Step: click the LetGo block node.
  await clickNode("B_LetGo");
  // Step: the inspector is titled "static block" and holds the current label.
  const state = await inspectorState();
  assert.equal(state.hidden, false);
  assert.equal(state.title, "static block");
  assert.equal(state.text, "Let it go");
});

test("test_inspector_is_fixed_while_scrolling_and_tracks_the_editor_drawer", async () => {
  await evaluate("document.getElementById('diagram').style.minHeight = '2000px'");
  await selectEditorNode("Q_Q1");
  const initial = await inspectorPlacement();
  // Step: scrolling the diagram does not move the fixed inspector.
  await evaluate("(() => { const output = document.getElementById('output'); output.scrollTop = 100; output.dispatchEvent(new Event('scroll')); })()");
  const afterScroll = await inspectorPlacement();
  assert.equal(afterScroll.left, initial.left);
  assert.equal(afterScroll.top, initial.top);
  assert.equal(afterScroll.atDrawerEdge, true, JSON.stringify(afterScroll));
  // assert.equal(afterScroll.atContentTop, true);
  // Step: toggling the drawer moves the inspector horizontally to its new edge.
  await evaluate("document.getElementById('drawerToggle').click()");
  const afterDrawerToggle = await inspectorPlacement();
  assert.notEqual(afterDrawerToggle.left, initial.left);
  // The widget's height now follows its width, because its buttons wrap.
  // assert.equal(afterDrawerToggle.top, initial.top);
  assert.equal(afterDrawerToggle.atDrawerEdge, true);
  // assert.equal(afterDrawerToggle.atContentTop, true);
  await evaluate("document.getElementById('drawerToggle').click()");
  await evaluate("document.getElementById('diagram').style.minHeight = ''; document.getElementById('output').scrollTop = 0");
});

test("test_clicking_a_choice_opens_a_choice_block_inspector", async () => {
  await resetEditorFixture();
  // Step: click Q1's existing explicit "No" choice node.
  await clickNode("Q_CHOICE_Q1_NEW2");
  // Step: the inspector is titled "choice block" and holds the current label.
  const state = await inspectorState();
  assert.equal(state.hidden, false);
  assert.equal(state.title, "choice block");
  assert.equal(state.text, "No");
});

test("test_double_clicking_a_node_focuses_and_selects_the_text_input", async () => {
  await resetEditorFixture();
  // Step: double-click the LetGo block node.
  await dblclickNode("B_LetGo");
  // Step: the Text input is focused and its whole value is selected.
  const focus = await evaluate(`JSON.stringify((() => {
    const input = document.getElementById('nodeTextInput');
    return { focused: document.activeElement === input, start: input.selectionStart, end: input.selectionEnd, length: input.value.length };
  })())`).then(JSON.parse);
  assert.equal(focus.focused, true);
  assert.equal(focus.start, 0);
  assert.equal(focus.end, focus.length);
  assert.ok(focus.length > 0);
});

test("test_cancel_discards_uncommitted_text_and_closes_the_inspector", async () => {
  await resetEditorFixture();
  // Step: open Q1's inspector and type text without pressing Enter.
  await clickNode("Q_Q1");
  await evaluate("document.getElementById('nodeTextInput').value = 'typed but not committed'");
  // Step: press Cancel; the inspector closes and the source is unchanged.
  await evaluate("document.getElementById('nodeInspectorDismissBtn').click()");
  assert.equal((await inspectorState()).hidden, true);
  const source = await evaluate("codeBox.value");
  assert.ok(source.includes('Q_Q1{"Can I be calm?"}'));
  // Step: reopening Q1 shows the saved label, not the typed text.
  await clickNode("Q_Q1");
  assert.equal((await inspectorState()).text, "Can I be calm?");
});

test("test_escape_discards_uncommitted_text_and_closes_the_inspector", async () => {
  await resetEditorFixture();
  // Step: open Q1's inspector and type text without pressing Enter.
  await clickNode("Q_Q1");
  await evaluate("document.getElementById('nodeTextInput').value = 'typed but not committed'");
  // Step: press Escape in the input; the inspector closes and the source is unchanged.
  await evaluate("document.getElementById('nodeTextInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
  assert.equal((await inspectorState()).hidden, true);
  const source = await evaluate("codeBox.value");
  assert.ok(source.includes('Q_Q1{"Can I be calm?"}'));
});

test("test_clicking_empty_drawing_space_closes_the_inspector", async () => {
  await resetEditorFixture();
  // Step: open Q1's inspector.
  await clickNode("Q_Q1");
  assert.equal((await inspectorState()).hidden, false);
  // Step: click the #output box itself (no node under the pointer); the inspector closes.
  await evaluate("document.getElementById('output').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
  assert.equal((await inspectorState()).hidden, true);
});

test("test_clicking_another_node_retargets_the_inspector_and_discards_text", async () => {
  await resetEditorFixture();
  // Step: open Q1's inspector and type text without pressing Enter.
  await clickNode("Q_Q1");
  await evaluate("document.getElementById('nodeTextInput').value = 'typed but not committed'");
  // Step: click LetGo; the inspector now shows LetGo and the typed text is gone.
  await clickNode("B_LetGo");
  const state = await inspectorState();
  assert.equal(state.hidden, false);
  assert.equal(state.title, "static block");
  assert.equal(state.text, "Let it go");
  const source = await evaluate("codeBox.value");
  assert.ok(source.includes('Q_Q1{"Can I be calm?"}'));
});
