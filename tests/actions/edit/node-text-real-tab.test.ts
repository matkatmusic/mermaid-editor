import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { SEARCH_FIXTURE } from "../../fixtures.ts";
import { clickNodeWithMouse, KeyName, pressKey } from "../../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

async function typeInNodeTextAndPressTab(id: string, newText: string, expectedToken: string) {
  // Scenario: select the node with a real click, type in Node text with real keys, press the real Tab key.
  await resetEditorFixture();
  await setEditorSource(SEARCH_FIXTURE);
  // await waitMilliseconds(500);
  await clickNodeWithMouse(id);
  await executeExpression("(() => { const input = document.getElementById('nodeTextInput'); input.focus(); input.select(); })()");
  await send("Input.insertText", { text: newText });
  await pressKey(KeyName.Tab);
  await executeExpression("window.editorActionPromise");
  // await waitMilliseconds(500);
  // The source has the new text.
  // assert.ok((await executeExpression("codeBox.value")).includes(expectedToken), expectedToken);
  assert.ok((await executeExpression<string>("codeBox.value")).includes(expectedToken), expectedToken);
  // The diagram shows the new text.
  // assert.ok((await executeExpression(`document.querySelector('#diagram [id*="flowchart-${id}-"]').textContent`)).includes(newText));
  assert.ok((await executeExpression<string>(`document.querySelector('#diagram [id*="flowchart-${id}-"]').textContent`)).includes(newText));
}

test("test_real_tab_after_double_click_and_key_by_key_typing_writes_the_text", async () => {
  // Scenario: real double click opens the Node text box; keys are typed one at a time; real Tab.
  await resetEditorFixture();
  await setEditorSource(SEARCH_FIXTURE);
  // await waitMilliseconds(500);
  // const center = JSON.parse(await executeExpression(`JSON.stringify((() => {
  const center: { x: number; y: number } = JSON.parse(await executeExpression<string>(`JSON.stringify((() => {
    const node = document.querySelector('#diagram [id*="flowchart-B_MIDDLE-"]');
    node.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })())`));
  for (const clickCount of [1, 2]) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount });
  }
  // await waitMilliseconds(500);
  assert.equal(await executeExpression("document.activeElement.id"), "nodeTextInput");
  for (const character of "Halfway")
    await send("Input.dispatchKeyEvent", { type: "char", text: character, key: character });
  await pressKey(KeyName.Tab);
  await executeExpression("window.editorActionPromise");
  // await waitMilliseconds(500);
  // assert.ok((await executeExpression("codeBox.value")).includes('B_MIDDLE["Halfway"]'));
  assert.ok((await executeExpression<string>("codeBox.value")).includes('B_MIDDLE["Halfway"]'));
  // assert.ok((await executeExpression("document.querySelector('#diagram [id*=\"flowchart-B_MIDDLE-\"]').textContent")).includes("Halfway"));
  assert.ok((await executeExpression<string>("document.querySelector('#diagram [id*=\"flowchart-B_MIDDLE-\"]').textContent")).includes("Halfway"));
});

async function replaceLineAndTypeNewTextThenTab(id: string, oldLine: string, newLine: string, newText: string) {
  // Scenario: the node's old text holds "]" or "}", is edited with real typing, then the real Tab key.
  await resetEditorFixture();
  await setEditorSource(SEARCH_FIXTURE.replace(oldLine, newLine));
  // await waitMilliseconds(500);
  await clickNodeWithMouse(id);
  await executeExpression("(() => { const input = document.getElementById('nodeTextInput'); input.focus(); input.select(); })()");
  await send("Input.insertText", { text: newText });
  await pressKey(KeyName.Tab);
  await executeExpression("window.editorActionPromise");
  // await waitMilliseconds(500);
}

test("test_real_tab_replaces_a_block_text_that_holds_a_closing_square_bracket", async () => {
  await replaceLineAndTypeNewTextThenTab("B_MIDDLE", '  B_MIDDLE["Middle"]', '  B_MIDDLE["Take the script run:\\nscript = scriptsToRun[i];"]', "Halfway");
  // const lines: string[] = (await executeExpression("codeBox.value")).split("\n");
  const lines: string[] = (await executeExpression<string>("codeBox.value")).split("\n");
  assert.ok(lines.includes('  B_MIDDLE["Halfway"]'), lines.filter((line) => line.includes("B_MIDDLE[")).join("|"));
  assert.equal(await executeExpression("document.getElementById('error').textContent"), "");
});

test("test_real_tab_replaces_a_question_text_that_holds_a_closing_curly_bracket", async () => {
  await replaceLineAndTypeNewTextThenTab("Q_FIRST", '  Q_FIRST{"First decision"}', '  Q_FIRST{"Is a == {x}?"}', "Can I pause?");
  // const lines: string[] = (await executeExpression("codeBox.value")).split("\n");
  const lines: string[] = (await executeExpression<string>("codeBox.value")).split("\n");
  assert.ok(lines.includes('  Q_FIRST{"Can I pause?"}'), lines.filter((line) => line.includes("Q_FIRST{")).join("|"));
  assert.equal(await executeExpression("document.getElementById('error').textContent"), "");
});

test("test_real_tab_writes_new_text_that_holds_a_closing_square_bracket_and_a_second_edit_replaces_it", async () => {
  await replaceLineAndTypeNewTextThenTab("B_MIDDLE", '  B_MIDDLE["Middle"]', '  B_MIDDLE["Middle"]', "item[i]");
  // assert.ok((await executeExpression("codeBox.value")).split("\n").includes('  B_MIDDLE["item[i]"]'));
  assert.ok((await executeExpression<string>("codeBox.value")).split("\n").includes('  B_MIDDLE["item[i]"]'));
  await executeExpression("(() => { const input = document.getElementById('nodeTextInput'); input.focus(); input.select(); })()");
  await send("Input.insertText", { text: "Done" });
  await pressKey(KeyName.Tab);
  await executeExpression("window.editorActionPromise");
  // await waitMilliseconds(500);
  // assert.ok((await executeExpression("codeBox.value")).split("\n").includes('  B_MIDDLE["Done"]'));
  assert.ok((await executeExpression<string>("codeBox.value")).split("\n").includes('  B_MIDDLE["Done"]'));
});

test("test_real_tab_writes_a_typed_double_quote_as_a_quot_entity_and_the_box_and_diagram_show_the_quote", async () => {
  // Scenario: type Say "hi" in Node text, press Tab; the source holds #quot;, the box and diagram show ".
  await resetEditorFixture();
  await setEditorSource(SEARCH_FIXTURE);
  // await waitMilliseconds(500);
  await clickNodeWithMouse("B_MIDDLE");
  await executeExpression("(() => { const input = document.getElementById('nodeTextInput'); input.focus(); input.select(); })()");
  await send("Input.insertText", { text: 'Say "hi"' });
  await pressKey(KeyName.Tab);
  await executeExpression("window.editorActionPromise");
  // await waitMilliseconds(500);
  // const lines: string[] = (await executeExpression("codeBox.value")).split("\n");
  const lines: string[] = (await executeExpression<string>("codeBox.value")).split("\n");
  assert.ok(lines.includes('  B_MIDDLE["Say #quot;hi#quot;"]'),lines.filter((line) => line.includes("B_MIDDLE[")).join("|"));
  assert.equal(await executeExpression("document.getElementById('error').textContent"), "");
  assert.equal(await executeExpression("document.getElementById('nodeTextInput').value"), 'Say "hi"');
  // assert.ok((await executeExpression("document.querySelector('#diagram [id*=\"flowchart-B_MIDDLE-\"]').textContent")).includes('Say "hi"'));
  assert.ok((await executeExpression<string>("document.querySelector('#diagram [id*=\"flowchart-B_MIDDLE-\"]').textContent")).includes('Say "hi"'));
  // Step: a second edit of the same node must not double the entity.
  await executeExpression("(() => { const input = document.getElementById('nodeTextInput'); input.focus(); input.setSelectionRange(input.value.length, input.value.length); })()");
  await send("Input.insertText", { text: " now" });
  await pressKey(KeyName.Tab);
  await executeExpression("window.editorActionPromise");
  // await waitMilliseconds(500);
  // const secondLines: string[] = (await executeExpression("codeBox.value")).split("\n");
  const secondLines: string[] = (await executeExpression<string>("codeBox.value")).split("\n");
  assert.ok(secondLines.includes('  B_MIDDLE["Say #quot;hi#quot; now"]'), secondLines.filter((line) => line.includes("B_MIDDLE[")).join("|"));
});

test("test_real_tab_leaves_other_nodes_with_quot_entities_as_they_are", async () => {
  // Scenario: another node already holds #quot; in the file; editing B_MIDDLE leaves that line as it is.
  await resetEditorFixture();
  await setEditorSource(SEARCH_FIXTURE.replace('  B_START["Start"]', '  B_START["Say #quot;go#quot;"]'));
  // await waitMilliseconds(500);
  await clickNodeWithMouse("B_MIDDLE");
  await executeExpression("(() => { const input = document.getElementById('nodeTextInput'); input.focus(); input.select(); })()");
  await send("Input.insertText", { text: "Halfway" });
  await pressKey(KeyName.Tab);
  await executeExpression("window.editorActionPromise");
  // await waitMilliseconds(500);
  // assert.ok((await executeExpression("codeBox.value")).split("\n").includes('  B_START["Say #quot;go#quot;"]'));
  assert.ok((await executeExpression<string>("codeBox.value")).split("\n").includes('  B_START["Say #quot;go#quot;"]'));
});

test("test_real_tab_after_real_typing_in_node_text_writes_a_question", async () => {
  await typeInNodeTextAndPressTab("Q_FIRST", "Can I pause?", 'Q_FIRST{"Can I pause?"}');
});

test("test_real_tab_after_real_typing_in_node_text_writes_a_block", async () => {
  await typeInNodeTextAndPressTab("B_MIDDLE", "Halfway", 'B_MIDDLE["Halfway"]');
});

test("test_real_tab_after_real_typing_in_node_text_writes_a_choice", async () => {
  await typeInNodeTextAndPressTab("Q_CHOICE_FIRST_YES", "Sure", 'Q_CHOICE_FIRST_YES["Sure"]');
});
