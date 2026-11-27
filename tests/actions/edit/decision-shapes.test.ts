import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "../../browser-harness.ts";
import { executeExpression, send, waitForRender, waitMilliseconds } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse, KeyName, pressKey } from "../../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const SOURCE = [
    "flowchart TD",
    '  B_START["Start"]',
    '  Q_DIAMOND{"Diamond?"}',
    '  Q_HEX{{"Hex } and }} ?"}}',
    '  Q_CHOICE_DIAMOND_YES["Yes"]',
    '  Q_CHOICE_DIAMOND_NO["No"]',
    '  Q_CHOICE_HEX_YES["Yes"]',
    '  Q_CHOICE_HEX_NO["No"]',
    '  B_END["End"]',
    "  B_START --> Q_DIAMOND",
    "  Q_DIAMOND --> Q_CHOICE_DIAMOND_YES --> Q_HEX",
    "  Q_DIAMOND --> Q_CHOICE_DIAMOND_NO --> B_END",
    "  Q_HEX --> Q_CHOICE_HEX_YES --> B_END",
    "  Q_HEX --> Q_CHOICE_HEX_NO --> B_END",
].join("\n");

async function loadFixture() {
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    await waitMilliseconds(600);
}

async function readSourceLines(): Promise<string[]> {
    // return (await executeExpression("codeBox.value")).split("\n");
    return (await executeExpression<string>("codeBox.value")).split("\n");
}

async function typeIntoNodeTextAndPressEnter(id: string, text: string) {
    await clickNodeWithMouse(id);
    await executeExpression("(() => { const input = document.getElementById('nodeTextInput'); input.focus(); input.select(); })()");
    await send("Input.insertText", { text });
    await pressKey(KeyName.Enter);
    await executeExpression("window.editorActionPromise");
    await waitMilliseconds(500);
}

async function countShapePoints(id: string): Promise<number> {
    return executeExpression(`document.querySelector('#diagram g.node[id*="flowchart-${id}-"] polygon').points.numberOfItems`);
}

test("test_a_hexagon_decision_and_a_diamond_decision_render_with_different_shapes", async () => {
    await loadFixture();
    assert.equal(await executeExpression("document.getElementById('error').textContent"), "");
    assert.equal(await countShapePoints("Q_DIAMOND"), 4);
    assert.equal(await countShapePoints("Q_HEX"), 6);
});

test("test_node_text_save_keeps_a_diamond_decision_a_diamond", async () => {
    await loadFixture();
    await typeIntoNodeTextAndPressEnter("Q_DIAMOND", "Diamond } now?");
    assert.ok((await readSourceLines()).includes('  Q_DIAMOND{"Diamond } now?"}'));
});

test("test_node_text_save_keeps_a_hexagon_decision_a_hexagon", async () => {
    await loadFixture();
    await typeIntoNodeTextAndPressEnter("Q_HEX", "Hex }} now?");
    assert.ok((await readSourceLines()).includes('  Q_HEX{{"Hex }} now?"}}'));
});

test("test_rename_keeps_each_decision_in_its_own_shape", async () => {
    await loadFixture();
    for (const [id, expectedLine] of [["Q_DIAMOND", '  Q_DIAMOND2{"Diamond?"}'], ["Q_HEX", '  Q_HEX2{{"Hex } and }} ?"}}']]) {
        await clickNodeWithMouse(id);
        await executeExpression("(() => { const input = document.getElementById('nodeNameInput'); input.focus(); input.select(); })()");
        await send("Input.insertText", { text: id.replace("Q_", "") + "2" });
        await pressKey(KeyName.Enter);
        await executeExpression("window.editorActionPromise");
        await waitMilliseconds(500);
        assert.ok((await readSourceLines()).includes(expectedLine), expectedLine);
    }
});

test("test_a_new_decision_after_a_block_is_written_as_a_hexagon", async () => {
    await loadFixture();
    await clickNodeWithMouse("B_END");
    await executeExpression("document.querySelector('#nodeInspectorActions [data-action=\"insert-decision-after\"]').click()");
    await executeExpression("window.editorActionPromise");
    await waitMilliseconds(500);
    const newDecisionLines = (await readSourceLines()).filter((line) => line.includes('"New Decision"'));
    assert.equal(newDecisionLines.length, 1, newDecisionLines.join("|"));
    assert.match(newDecisionLines[0], /^  Q_[A-Za-z0-9_]+\{\{"New Decision"\}\}$/);
});

test("test_a_written_path_keeps_each_decision_in_its_own_shape", async () => {
    await loadFixture();
    for (const choiceId of ["Q_CHOICE_DIAMOND_YES", "Q_CHOICE_HEX_YES"]) {
        await executeExpression(`document.querySelector('#phoneDiagram [data-choose="${choiceId}"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
        await waitForRender();
    }
    await executeExpression("document.querySelector('#phoneTopBar [data-write-path]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
    await waitMilliseconds(500);
    // const names: string[] = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams`).then((response) => response.json());
    const names = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams`).then((response) => response.json() as Promise<string[]>);
    const pathName = names.filter((name) => name.includes("-path-")).sort().pop()!;
    const pathSource = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${pathName}`).then((response) => response.text());
    assert.ok(pathSource.includes('  Q_DIAMOND{"Diamond?"}'), pathSource);
    assert.ok(pathSource.includes('  Q_HEX{{"Hex } and }} ?"}}'), pathSource);
});
