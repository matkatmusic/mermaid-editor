import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "./browser-harness.ts";
import { executeExpression, send, waitForRender, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse, KeyName, pressKey } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const BODY = [
    "flowchart TD",
    '  B_START["Start"]',
    '  Q_A{{"Does it work?"}}',
    '  Q_CHOICE_A_Y["Yes"]',
    '  Q_CHOICE_A_N["No"]',
    '  B_END["End"]',
    "  B_START --> Q_A",
    "  Q_A --> Q_CHOICE_A_Y --> B_END",
    "  Q_A --> Q_CHOICE_A_N --> B_END",
].join("\n");

// 25 "0" characters measured in the page font is 209.77 px; the node box adds 8 px of padding to the text area.
const MINIMUM_NODE_WIDTH = 209.77 + 8;
// 2 text rows of 24 px each, plus 8 px of padding.
const MINIMUM_NODE_HEIGHT = 48 + 8;

async function loadSource(source: string) {
    await resetEditorFixture();
    await setEditorSource(source);
    await waitMilliseconds(600);
}

async function readNodeBox(id: string): Promise<{ width: number; height: number }> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const box = document.querySelector('#diagram g.node[id*="flowchart-${id}-"] rect').getBBox();
        return { width: box.width, height: box.height };
    })())`));
}

async function readSourceLines(): Promise<string[]> {
    // return (await executeExpression("codeBox.value")).split("\n");
    return (await executeExpression<string>("codeBox.value")).split("\n");
}

test("test_a_sized_block_renders_at_the_stored_size", async () => {
    // Scenario: a size line of 400 by 120 makes the node box 400 by 120 px.
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_START","width":400,"height":120}`);
    const box = await readNodeBox("B_START");
    assert.ok(Math.abs(box.width - 400) < 1, JSON.stringify(box));
    assert.ok(Math.abs(box.height - 120) < 1, JSON.stringify(box));
});

test("test_a_sized_choice_renders_at_the_stored_size", async () => {
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"Q_CHOICE_A_Y","width":300,"height":100}`);
    const box = await readNodeBox("Q_CHOICE_A_Y");
    assert.ok(Math.abs(box.width - 300) < 1, JSON.stringify(box));
    assert.ok(Math.abs(box.height - 100) < 1, JSON.stringify(box));
});

test("test_a_sized_hexagon_decision_renders_with_the_label_size_of_the_stored_size", async () => {
    // Scenario: a hexagon gets the same label size as a block; its box is wider than the label because of the side points.
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"Q_A","width":400,"height":120}`);
    // const box = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const box: { width: number; height: number; error: string } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const box = document.querySelector('#diagram g.node[id*="flowchart-Q_A-"] polygon').getBBox();
        return { width: box.width, height: box.height, error: document.getElementById('error').textContent };
    })())`));
    assert.equal(box.error, "");
    assert.ok(box.width >= 400 - 1, JSON.stringify(box));
    assert.ok(box.height >= 120 - 1, JSON.stringify(box));
});

test("test_a_size_smaller_than_the_minimum_renders_at_25_zero_characters_and_2_rows", async () => {
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_START","width":50,"height":20}`);
    const box = await readNodeBox("B_START");
    assert.ok(Math.abs(box.width - MINIMUM_NODE_WIDTH) < 1.5, JSON.stringify(box));
    assert.ok(Math.abs(box.height - MINIMUM_NODE_HEIGHT) < 1.5, JSON.stringify(box));
});

test("test_a_block_grows_taller_when_its_text_does_not_fit_the_stored_height", async () => {
    // Scenario: the stored height stays 30; the node grows and the text stays visible.
    const longText = Array.from({ length: 40 }, () => "word").join(" ");
    await loadSource(`${BODY.replace('B_START["Start"]', `B_START["${longText}"]`)}\n%% ==props==: {"blockId":"B_START","width":300,"height":30}`);
    const box = await readNodeBox("B_START");
    assert.ok(Math.abs(box.width - 300) < 1, JSON.stringify(box));
    assert.ok(box.height > MINIMUM_NODE_HEIGHT + 24, JSON.stringify(box));
    assert.ok((await readSourceLines()).includes('%% ==props==: {"blockId":"B_START","width":300,"height":30}'));
});

test("test_a_node_without_a_size_line_gives_mermaid_the_same_line_as_before", async () => {
    // Scenario: only B_START has a size line; the line of B_END that Mermaid gets only gets the negative margin wrapper of every block.
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_START","width":400,"height":120}`);
    await executeExpression(`(() => {
        window.capturedSources = [];
        window.originalMermaidRender = mermaid.render;
        mermaid.render = (...args) => { window.capturedSources.push(args[1]); return window.originalMermaidRender.apply(mermaid, args); };
    })()`);
    await executeExpression("window.render()");
    const captured: string = await executeExpression("window.capturedSources[0]");
    await executeExpression("mermaid.render = window.originalMermaidRender");
    const lines = captured.split("\n");
    assert.ok(lines.includes('  B_END["<div style=\'margin:-8px -12px\'>End</div>"]'), captured);
    assert.ok(lines.some((line) => line.startsWith('  B_START["<div style=')), captured);
});

test("test_set_node_size_writes_one_size_line_and_undo_takes_it_away", async () => {
    await loadSource(BODY);
    await executeExpression("window.setNodeSize('B_START', 400, 120); window.editorActionPromise");
    await waitMilliseconds(500);
    const lines = await readSourceLines();
    assert.equal(lines.filter((line) => line.includes("==props==")).length, 1);
    // const metadataIndex = lines.indexOf("%%%%====");
    // assert.ok(lines.indexOf("%% ==size==: B_START 400 120") < metadataIndex, lines.join("|"));
    assert.equal(lines[lines.indexOf('  B_START["Start"]') - 1], '  %% ==props==: {"blockId":"B_START","width":400,"height":120}', lines.join("|"));
    await executeExpression("window.setNodeSize('B_START', 500, 150); window.editorActionPromise");
    await waitMilliseconds(500);
    const resized = (await readSourceLines()).filter((line) => line.includes("==props=="));
    assert.deepEqual(resized, ['  %% ==props==: {"blockId":"B_START","width":500,"height":150}']);
    await executeExpression("window.applyEditorUndo(); window.editorActionPromise");
    await waitMilliseconds(500);
    const undone = (await readSourceLines()).filter((line) => line.includes("==props=="));
    assert.deepEqual(undone, ['  %% ==props==: {"blockId":"B_START","width":400,"height":120}']);
});

test("test_removing_a_node_removes_its_size_line", async () => {
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_END","width":400,"height":120}\n%% ==props==: {"blockId":"B_START","width":300,"height":90}`);
    await clickNodeWithMouse("B_END");
    await waitMilliseconds(300);
    await executeExpression("window.removeBlock(); window.editorActionPromise");
    await waitMilliseconds(500);
    const sizeLines = (await readSourceLines()).filter((line) => line.includes("==props=="));
    assert.deepEqual(sizeLines, ['%% ==props==: {"blockId":"B_START","width":300,"height":90}']);
});

test("test_renaming_a_node_renames_its_size_line", async () => {
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_END","width":400,"height":120}`);
    await clickNodeWithMouse("B_END");
    await waitMilliseconds(300);
    await executeExpression("(() => { const input = document.getElementById('nodeNameInput'); input.focus(); input.select(); })()");
    for (const character of "FINISH")
        await send("Input.dispatchKeyEvent", { type: "char", text: character, key: character });
    await pressKey(KeyName.Tab);
    await executeExpression("window.editorActionPromise");
    await waitMilliseconds(500);
    const sizeLines = (await readSourceLines()).filter((line) => line.includes("==props=="));
    assert.deepEqual(sizeLines, ['%% ==props==: {"blockId":"B_FINISH","width":400,"height":120}']);
});

test("test_searching_the_text_of_a_size_line_selects_its_node", async () => {
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_END","width":400,"height":120}`);
    await executeExpression("window.selectEditorNode(null)");
    await executeExpression(`(() => { const input = document.getElementById('searchInput'); input.value = '"width":400,"height":120'; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await waitMilliseconds(500);
    await waitForRender();
    assert.equal(await executeExpression("document.getElementById('selectedNode').textContent"), "B_END");
});

test("test_a_written_path_copies_the_size_lines_of_the_nodes_in_the_path_only", async () => {
    await loadSource(`${BODY}\n%% ==props==: {"blockId":"B_START","width":300,"height":90}\n%% ==props==: {"blockId":"Q_CHOICE_A_N","width":200,"height":80}\n%% ==props==: {"blockId":"Q_CHOICE_A_Y","width":220,"height":70}`);
    await executeExpression("document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_A_Y\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
    await waitForRender();
    await executeExpression("document.querySelector('#phoneTopBar [data-write-path]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
    await waitMilliseconds(500);
    const names: string[] = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams`).then((response) => response.json());
    const pathName = names.find((name) => name.includes("-path-"))!;
    assert.ok(pathName, JSON.stringify(names));
    const pathSource = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${pathName}`).then((response) => response.text());
    const sizeLines = pathSource.split("\n").filter((line) => line.includes("==props=="));
    // assert.deepEqual(sizeLines, ['  %% ==props==: {"blockId":"B_START","width":300,"height":90}', '  %% ==props==: {"blockId":"Q_CHOICE_A_Y","width":220,"height":70}'], pathSource);
    // The path file copies each props line as the source writes it.
    assert.deepEqual(sizeLines, ['%% ==props==: {"blockId":"B_START","width":300,"height":90}', '%% ==props==: {"blockId":"Q_CHOICE_A_Y","width":220,"height":70}'], pathSource);
});
