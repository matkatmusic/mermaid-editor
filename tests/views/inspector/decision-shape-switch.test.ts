import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse, Modifier } from "../../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const SOURCE = [
    "flowchart TD",
    '  B_START["Start"]',
    '  Q_DIAMOND{"Diamond? } here"}',
    '  Q_HEX{{"Hex? }} here"}}',
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
    "  classDef Decision fill:#ffff00,stroke:#000000",
    "  class Q_DIAMOND Decision",
].join("\n");

async function loadFixtureAndSelect(id: string) {
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    // await waitMilliseconds(600);
    await clickNodeWithMouse(id);
    // await waitMilliseconds(300);
}

interface SwitchState {
    isShown: boolean;
    isOnDiamondSide: boolean;
}

async function readSwitchState(): Promise<SwitchState> {
    // return JSON.parse(await executeExpression(`JSON.stringify((() => {
    // })())`));
    return JSON.parse(await executeExpression<string>(`JSON.stringify((() => {
        const row = document.getElementById('decisionShapeRow');
        const rect = row.getBoundingClientRect();
        return { isShown: !row.hidden && rect.width > 0 && rect.height > 0, isOnDiamondSide: document.getElementById('decisionShapeSwitch').checked };
    })())`)) as SwitchState;
}

async function clickSwitchWithMouse() {
    // const center = JSON.parse(await executeExpression(`JSON.stringify((() => {
    // })())`));
    const center = JSON.parse(await executeExpression<string>(`JSON.stringify((() => {
        const rect = document.getElementById('decisionShapeSwitch').getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })())`)) as { x: number; y: number };
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount: 1 });
    await executeExpression("window.editorActionPromise");
    // await waitMilliseconds(500);
}

async function readSourceLines(): Promise<string[]> {
    // return (await executeExpression("codeBox.value")).split("\n");
    return (await executeExpression<string>("codeBox.value")).split("\n");
}

async function countShapePoints(id: string): Promise<number> {
    return executeExpression(`document.querySelector('#diagram g.node[id*="flowchart-${id}-"] polygon').points.numberOfItems`);
}

test("test_type_row_says_decision_and_not_question", async () => {
    await loadFixtureAndSelect("Q_HEX");
    const rowText: string = await executeExpression("document.getElementById('nodeKindRow').textContent");
    assert.ok(rowText.includes("Decision"), rowText);
    assert.ok(!rowText.includes("Question"), rowText);
});

test("test_switch_is_hidden_for_a_static_block", async () => {
    await loadFixtureAndSelect("B_END");
    assert.equal((await readSwitchState()).isShown, false);
});

test("test_switch_is_hidden_for_a_choice", async () => {
    await loadFixtureAndSelect("Q_CHOICE_HEX_YES");
    assert.equal((await readSwitchState()).isShown, false);
});

test("test_switch_knob_is_on_the_diamond_side_for_a_brace_decision", async () => {
    await loadFixtureAndSelect("Q_DIAMOND");
    assert.deepEqual(await readSwitchState(), { isShown: true, isOnDiamondSide: true });
});

test("test_switch_knob_is_on_the_hexagon_side_for_a_double_brace_decision", async () => {
    await loadFixtureAndSelect("Q_HEX");
    assert.deepEqual(await readSwitchState(), { isShown: true, isOnDiamondSide: false });
});

test("test_clicking_the_switch_turns_a_diamond_decision_into_a_hexagon_and_changes_only_that_line", async () => {
    await loadFixtureAndSelect("Q_DIAMOND");
    const linesBefore = await readSourceLines();
    // const historyLengthBefore = await executeExpression("editorHistory.length");
    const historyLengthBefore = await executeExpression<number>("editorHistory.length");
    await clickSwitchWithMouse();
    const linesAfter = await readSourceLines();
    const changedLineNumbers = linesBefore.map((line, index) => (line === linesAfter[index] ? -1 : index)).filter((index) => index >= 0);
    assert.equal(changedLineNumbers.length, 1, changedLineNumbers.join(","));
    assert.equal(linesAfter[changedLineNumbers[0]], '  Q_DIAMOND{{"Diamond? } here"}}');
    assert.ok(linesAfter.includes("  class Q_DIAMOND Decision"));
    assert.equal(await executeExpression("selectedEditorNodeId"), "Q_DIAMOND");
    assert.deepEqual(await readSwitchState(), { isShown: true, isOnDiamondSide: false });
    assert.equal(await countShapePoints("Q_DIAMOND"), 6);
    assert.equal(await executeExpression("editorHistory.length"), historyLengthBefore + 1);
});

test("test_clicking_the_switch_turns_a_hexagon_decision_into_a_diamond_and_changes_only_that_line", async () => {
    await loadFixtureAndSelect("Q_HEX");
    const linesBefore = await readSourceLines();
    await clickSwitchWithMouse();
    const linesAfter = await readSourceLines();
    const changedLineNumbers = linesBefore.map((line, index) => (line === linesAfter[index] ? -1 : index)).filter((index) => index >= 0);
    assert.equal(changedLineNumbers.length, 1, changedLineNumbers.join(","));
    assert.equal(linesAfter[changedLineNumbers[0]], '  Q_HEX{"Hex? }} here"}');
    assert.equal(await executeExpression("selectedEditorNodeId"), "Q_HEX");
    assert.deepEqual(await readSwitchState(), { isShown: true, isOnDiamondSide: true });
    assert.equal(await countShapePoints("Q_HEX"), 4);
});

test("test_a_new_decision_block_starts_as_a_hexagon_with_the_switch_on_the_hexagon_side", async () => {
    await loadFixtureAndSelect("B_END");
    await executeExpression("document.querySelector('#nodeInspectorActions [data-action=\"insert-decision-after\"]').click()");
    await executeExpression("window.editorActionPromise");
    // await waitMilliseconds(500);
    await clickNodeWithMouse("Q_NEW_1");
    // await waitMilliseconds(300);
    assert.ok((await readSourceLines()).includes('  Q_NEW_1{{"New Decision"}}'));
    assert.deepEqual(await readSwitchState(), { isShown: true, isOnDiamondSide: false });
});

test("test_the_switch_is_hidden_while_several_nodes_are_selected", async () => {
    await loadFixtureAndSelect("Q_HEX");
    await clickNodeWithMouse("Q_DIAMOND", Modifier.Meta);
    // await waitMilliseconds(300);
    assert.equal((await readSwitchState()).isShown, false);
});
