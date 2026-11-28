import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../browser-harness.ts";
// import { executeExpression, send, waitMilliseconds } from "../cdp.ts";
import { executeExpression, send } from "../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../editor-helpers.ts";
import { clickNodeWithMouse, KeyName, pressKey } from "../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const USER_LABEL = "`if (i < puzzle.size())`\nIs there a pair of the original puzzle left to look at?";
const FILE_LABEL = "#96;if (i < puzzle.size())#96;<br/>Is there a pair of the original puzzle left to look at?";

async function loadFixture() {
    await resetEditorFixture();
    await setEditorSource('flowchart TD\n  B_A["Alpha"]\n  B_B["Beta"]\n  B_A --> B_B');
    // await waitMilliseconds(500);
}

async function typeNodeTextAndPressEnter(id: string, text: string) {
    await clickNodeWithMouse(id);
    await executeExpression("(() => { const input = document.getElementById('nodeTextInput'); input.focus(); input.select(); })()");
    await send("Input.insertText", { text });
    await pressKey(KeyName.Enter);
    await executeExpression("window.editorActionPromise");
    // await waitMilliseconds(500);
}

async function getCodeSpanTexts(selector: string): Promise<string[]> {
    // return JSON.parse(await executeExpression(`JSON.stringify([...document.querySelectorAll('${selector} code')].map((code) => code.textContent))`));
    return JSON.parse(await executeExpression<string>(`JSON.stringify([...document.querySelectorAll('${selector} code')].map((code) => code.textContent))`)) as string[];
}

test("test_typed_backticks_are_saved_as_entities_and_the_file_parses", async () => {
    // Scenario: type the user's label (starts with a backtick, has a real line break) in Node text, press the real Enter key.
    await loadFixture();
    await typeNodeTextAndPressEnter("B_A", USER_LABEL);
    // The file holds #96; for every backtick.
    // const lines: string[] = (await executeExpression("codeBox.value")).split("\n");
    const lines: string[] = (await executeExpression<string>("codeBox.value")).split("\n");
    assert.ok(lines.includes(`  B_A["${FILE_LABEL}"]`), lines.join("|"));
    // The editor shows no error and Mermaid parses the file text as it is.
    assert.equal(await executeExpression("document.getElementById('error').textContent"), "");
    assert.equal(await executeExpression("mermaid.parse(codeBox.value).then(() => 'parses', (error) => String(error.message))"), "parses");
});

test("test_saved_backtick_entities_show_as_code_spans_and_as_backticks_in_node_text", async () => {
    await loadFixture();
    await typeNodeTextAndPressEnter("B_A", USER_LABEL);
    // The main diagram shows one code span with the < kept.
    assert.deepEqual(await getCodeSpanTexts('#diagram [id*="flowchart-B_A-"]'), ["if (i < puzzle.size())"]);
    // The phone block shows the same code span.
    await clickNodeWithMouse("B_A");
    // await waitMilliseconds(300);
    assert.deepEqual(await getCodeSpanTexts('#phoneDiagram [data-node-id="B_A"]'), ["if (i < puzzle.size())"]);
    // The Node text box shows backticks and a real line break, not #96;.
    assert.equal(await executeExpression("document.getElementById('nodeTextInput').value"), USER_LABEL);
});

test("test_saving_the_same_node_text_again_leaves_the_file_identical", async () => {
    await loadFixture();
    await typeNodeTextAndPressEnter("B_A", USER_LABEL);
    // The save-metadata comment at the end holds the scroll position, so only the diagram lines are compared.
    const getDiagramLines = async () => (await executeExpression("codeBox.value.split('%%%%====')[0]")) as string;
    const diagramLinesAfterFirstSave = await getDiagramLines();
    await typeNodeTextAndPressEnter("B_A", USER_LABEL);
    assert.equal(await getDiagramLines(), diagramLinesAfterFirstSave);
});

test("test_a_backtick_in_the_middle_of_node_text_is_saved_as_an_entity", async () => {
    await loadFixture();
    await typeNodeTextAndPressEnter("B_A", "Use `x` now");
    // const lines: string[] = (await executeExpression("codeBox.value")).split("\n");
    const lines: string[] = (await executeExpression<string>("codeBox.value")).split("\n");
    assert.ok(lines.includes('  B_A["Use #96;x#96; now"]'), lines.join("|"));
    assert.deepEqual(await getCodeSpanTexts('#diagram [id*="flowchart-B_A-"]'), ["x"]);
});

test("test_a_file_label_with_raw_backticks_still_shows_a_code_span_until_it_is_saved", async () => {
    await resetEditorFixture();
    await setEditorSource('flowchart TD\n  B_A["`code` first"]\n  B_B["Beta"]\n  B_A --> B_B');
    // await waitMilliseconds(500);
    assert.deepEqual(await getCodeSpanTexts('#diagram [id*="flowchart-B_A-"]'), ["code"]);
    await clickNodeWithMouse("B_A");
    assert.equal(await executeExpression("document.getElementById('nodeTextInput').value"), "`code` first");
});
