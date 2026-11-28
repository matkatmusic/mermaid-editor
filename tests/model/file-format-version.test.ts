import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "../browser-harness.ts";
// import { executeExpression, send, waitMilliseconds } from "../cdp.ts";
import { executeExpression, send, waitForExpression } from "../cdp.ts";
import { openEditorDrawer } from "../editor-helpers.ts";
import { EDITOR_FIXTURE_NAME } from "../fixtures.ts";
import { clickNodeWithMouse, KeyName, pressKey } from "../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const OLD_SOURCE = [
    "flowchart TD",
    "  %% ==note==: old note",
    '  B_A["Alpha"]',
    '  B_B["Beta"]',
    "  B_A --> B_B",
    "%% ==size==: B_A 240 80",
    "%% ==align==: B_A left top",
    "%% ==note:[B_B]==: new note",
].join("\n");
const PROPS_LINE_OF_A = '  %% ==props==: {"blockId":"B_A","alignment":"top","justification":"left","width":240,"height":80,"note":"old note"}';
const PROPS_LINE_OF_B = '  %% ==props==: {"blockId":"B_B","note":"new note"}';

async function loadFileWithText(text: string) {
    await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`, { method: "PUT", body: text });
    await executeExpression(`loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`);
    // await waitMilliseconds(800);
}

async function readCodeBox(): Promise<string> {
    return executeExpression("codeBox.value");
}

test("test_a_file_without_a_version_loads_with_its_old_lines_as_props_lines", async () => {
    await loadFileWithText(OLD_SOURCE);
    const lines = (await readCodeBox()).split("\n");
    assert.deepEqual(lines.slice(0, 6), ["flowchart TD", PROPS_LINE_OF_A, '  B_A["Alpha"]', PROPS_LINE_OF_B, '  B_B["Beta"]', "  B_A --> B_B"]);
    assert.equal(await executeExpression("document.getElementById('error').textContent"), "");
});

test("test_save_writes_file_format_version_2_in_the_footer", async () => {
    // Step: load an old file, then click a block, which saves the file.
    await loadFileWithText(OLD_SOURCE);
    await clickNodeWithMouse("B_A");
    // await waitMilliseconds(800);
    await waitForExpression('pendingSaveCount === 0');
    const saved = await (await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`)).text();
    assert.ok(saved.includes('"fileFormatVersion":2'), saved);
    assert.ok(saved.includes(PROPS_LINE_OF_A), saved);
    assert.ok(!saved.includes("==size=="), saved);
});

test("test_a_broken_props_line_in_a_version_2_file_shows_an_error_in_the_page", async () => {
    const source = 'flowchart TD\n  %% ==props==: {"blockId":"B_A",}\n  B_A["Alpha"]\n%%%%====\n%% DO NOT MODIFY - AUTOMATICALLY GENERATED DURING EVERY SAVE\n%% {"fileFormatVersion":2,"lastSelectedNodeId":null}\n%%%%====';
    await loadFileWithText(source);
    const errorText: string = await executeExpression("document.getElementById('error').textContent");
    assert.ok(errorText.includes("JSON"), errorText);
    assert.equal(await executeExpression("document.querySelector('#error .error-line-link')?.dataset.line"), "2", errorText);
});

const OPEN_PATH = "/tmp/file-format-open.mmd";
const BROKEN_SOURCE_WITHOUT_VERSION = 'flowchart TD\n  %% ==props==: {"blockId":"B_A",}\n  B_A["Alpha"]';

// Opens one good file by path, then runs a load that must fail, and reads what the page still holds.
async function readPageAfterFailedLoad(failingLoad: string) {
    await executeExpression(`showOpenedFile(${JSON.stringify(OPEN_PATH)}, 'flowchart TD\\n  B_KEPT["Kept"]')`);
    // await waitMilliseconds(800);
    const failed: boolean = await executeExpression(`${failingLoad}.then(() => false, () => true)`);
    return { failed, status: await executeExpression("document.getElementById('status').textContent") as string, source: await readCodeBox() };
}

test("test_a_failed_open_of_a_broken_file_keeps_the_open_file_as_the_save_target", async () => {
    const page = await readPageAfterFailedLoad(`showOpenedFile('/tmp/file-format-broken.mmd', ${JSON.stringify(BROKEN_SOURCE_WITHOUT_VERSION)})`);
    assert.equal(page.failed, true);
    assert.equal(page.status, OPEN_PATH);
    assert.ok(page.source.includes("B_KEPT"), page.source);
});

test("test_a_failed_load_of_a_broken_diagram_keeps_the_open_file_as_the_save_target", async () => {
    await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`, { method: "PUT", body: BROKEN_SOURCE_WITHOUT_VERSION });
    const page = await readPageAfterFailedLoad(`loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`);
    assert.equal(page.failed, true);
    assert.equal(await executeExpression("loadedPath"), OPEN_PATH);
    assert.ok(page.source.includes("B_KEPT"), page.source);
});

test("test_a_file_whose_footer_has_no_version_loads_with_its_old_lines_as_props_lines", async () => {
    await loadFileWithText(`${OLD_SOURCE}\n%%%%====\n%% DO NOT MODIFY - AUTOMATICALLY GENERATED DURING EVERY SAVE\n%% {"lastSelectedNodeId":null}\n%%%%====`);
    const lines = (await readCodeBox()).split("\n");
    assert.equal(lines[1], PROPS_LINE_OF_A);
    assert.equal(lines[3], PROPS_LINE_OF_B);
});

test("test_a_note_with_commas_braces_and_quotes_is_saved_and_read_back", async () => {
    // Step: type the note in the Notes box and press Enter.
    const note = 'Text, with {commas} and "quotes"';
    await loadFileWithText('flowchart TD\n  B_A["Alpha"]\n  B_B["Beta"]\n  B_A --> B_B');
    await clickNodeWithMouse("B_A");
    // await waitMilliseconds(300);
    await executeExpression("(() => { const box = document.getElementById('nodeNotesInput'); box.focus(); box.select(); })()");
    await send("Input.insertText", { text: note });
    await pressKey(KeyName.Enter);
    await executeExpression("window.editorActionPromise");
    // await waitMilliseconds(500);
    // Step: the diagram shows no error, and the box reads the note back after the file loads again.
    assert.equal(await executeExpression("document.getElementById('error').textContent"), "");
    await executeExpression(`loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`);
    // await waitMilliseconds(500);
    await clickNodeWithMouse("B_A");
    // await waitMilliseconds(300);
    assert.equal(await executeExpression("document.getElementById('nodeNotesInput').value"), note);
});

test("test_a_version_2_file_is_left_unchanged", async () => {
    const source = `${OLD_SOURCE}\n%%%%====\n%% DO NOT MODIFY - AUTOMATICALLY GENERATED DURING EVERY SAVE\n%% {"fileFormatVersion":2,"lastSelectedNodeId":null}\n%%%%====`;
    await loadFileWithText(source);
    assert.equal(await readCodeBox(), source);
});
