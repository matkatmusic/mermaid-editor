import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "../browser-harness.ts";
import { executeExpression, waitForRender, waitMilliseconds } from "../cdp.ts";
import { resetEditorFixture, setEditorSource } from "../editor-helpers.ts";

registerBrowserHooks(import.meta.url);

const SOURCE = [
    "flowchart TD",
    "  B_START[\"Start\"]",
    "  Q_A{\"Does #96;x#96; say #quot;hi#quot;?\"}",
    "  Q_CHOICE_A_Y[\"Yes #96;y#96;\"]",
    "  Q_CHOICE_A_N[\"No\"]",
    "  B_END[\"End\"]",
    "  B_START --> Q_A",
    "  Q_A --> Q_CHOICE_A_Y",
    "  Q_A --> Q_CHOICE_A_N",
    "  Q_CHOICE_A_Y --> B_END",
    "  Q_CHOICE_A_N --> B_END",
].join("\n");

test("test_decision_comment_lines_in_a_written_path_show_real_backticks_and_quotes", async () => {
    // Scenario: labels hold #96; and #quot; in the file; the path file comment must show ` and ".
    await resetEditorFixture();
    await setEditorSource(SOURCE);
    await waitMilliseconds(500);
    await executeExpression("document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_A_Y\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
    await waitForRender();
    await executeExpression("document.querySelector('#phoneTopBar [data-write-path]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
    await waitMilliseconds(500);
    // const names: string[] = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams`).then((response) => response.json());
    const names = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams`).then((response) => response.json() as Promise<string[]>);
    const pathName = names.find((name) => name.includes("-path-"))!;
    assert.ok(pathName, JSON.stringify(names));
    const pathSource = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${pathName}`).then((response) => response.text());
    assert.ok(pathSource.startsWith('%% Decisions made:\n%%   Does `x` say "hi"? -> Yes `y`\nflowchart TD\n'), pathSource);
});
