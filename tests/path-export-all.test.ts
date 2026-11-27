import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "./browser-harness.ts";
import { executeExpression, waitForRender, waitMilliseconds } from "./cdp.ts";

registerBrowserHooks(import.meta.url);

const LOOP_EDGES = [
  ["B_START", "Q_ASK"],
  ["Q_ASK", "Q_CHOICE_ASK_YES"],
  ["Q_CHOICE_ASK_YES", "B_END"],
  ["Q_ASK", "Q_CHOICE_ASK_NO"],
  ["Q_CHOICE_ASK_NO", "Q_ASK"],
];

test("test_list_all_path_ids_uses_each_edge_once_per_path_and_loops_back_to_a_decision", async () => {
  // Scenario: "No" loops back to the decision, so that path then takes the other answer.
  // const paths = await executeExpression(`JSON.stringify(listAllPathIds(${JSON.stringify(LOOP_EDGES)}))`).then(JSON.parse);
  const paths = await executeExpression<string>(`JSON.stringify(listAllPathIds(${JSON.stringify(LOOP_EDGES)}))`).then(JSON.parse);
  assert.deepEqual(paths, [
    ["B_START", "Q_ASK", "Q_CHOICE_ASK_YES", "B_END"],
    ["B_START", "Q_ASK", "Q_CHOICE_ASK_NO", "Q_ASK", "Q_CHOICE_ASK_YES", "B_END"],
  ]);
});

test("test_list_all_path_ids_lists_paths_from_every_start_node", async () => {
  // Scenario: two start nodes with no incoming edge; paths from both are listed.
  const edges = [
    ["B_FIRST", "B_FIRST_END"],
    ["B_SECOND", "B_SECOND_END"],
  ];
  // const paths = await executeExpression(`JSON.stringify(listAllPathIds(${JSON.stringify(edges)}))`).then(JSON.parse);
  const paths = await executeExpression<string>(`JSON.stringify(listAllPathIds(${JSON.stringify(edges)}))`).then(JSON.parse);
  assert.deepEqual(paths, [
    ["B_FIRST", "B_FIRST_END"],
    ["B_SECOND", "B_SECOND_END"],
  ]);
});

test("test_export_all_paths_button_writes_one_numbered_file_per_path", async () => {
  // Scenario: the test server saves into its temp DIAGRAMS_DIR copy, so the real diagrams stay untouched.
  const source = [
    "flowchart TD",
    '  B_START["Start"]',
    '  Q_ASK{"Done?"}',
    '  Q_CHOICE_ASK_YES["Yes"]',
    '  Q_CHOICE_ASK_NO["No"]',
    '  B_END["End"]',
    "  B_START --> Q_ASK",
    "  Q_ASK --> Q_CHOICE_ASK_YES",
    "  Q_CHOICE_ASK_YES --> B_END",
    "  Q_ASK --> Q_CHOICE_ASK_NO",
    "  Q_CHOICE_ASK_NO --> Q_ASK",
    "",
  ].join("\n");
  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/loop-demo.mmd`, { method: "PUT", body: source });
  await executeExpression("loadDiagram('loop-demo.mmd')");
  await waitMilliseconds(500);
  // Step: the click locks the source editor and the node text input, and leaves Walk back usable, until the writing stops.
  // const whileWriting = await executeExpression("document.getElementById('exportAllPathsBtn').click(), JSON.stringify({ isReadOnly: document.getElementById('code').readOnly, walkBackInert: !!document.getElementById('walkBackBtn').closest('[inert]'), nodeTextInert: !!document.getElementById('nodeTextInput').closest('[inert]') })").then(JSON.parse);
  const whileWriting = await executeExpression<string>("document.getElementById('exportAllPathsBtn').click(), JSON.stringify({ isReadOnly: document.getElementById('code').readOnly, walkBackInert: !!document.getElementById('walkBackBtn').closest('[inert]'), nodeTextInert: !!document.getElementById('nodeTextInput').closest('[inert]') })").then(JSON.parse);
  assert.deepEqual(whileWriting, { isReadOnly: true, walkBackInert: false, nodeTextInert: true });
  await waitMilliseconds(1000);
  // Step: one file per path, numbered from 0, and the status line reports the count.
  const names: string[] = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams`).then((r) => r.json());
  const pathNames = names.filter((name) => name.startsWith("loop-demo-path-"));
  assert.deepEqual(pathNames, ["loop-demo-path-0.mmd", "loop-demo-path-1.mmd"]);
  assert.equal(await executeExpression("document.getElementById('status').textContent"), "Wrote 2 paths");
  assert.equal(await executeExpression("document.getElementById('code').readOnly"), false);
  // Step: the looping path lists both answers it took.
  const loopPath = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/loop-demo-path-1.mmd`).then((r) => r.text());
  assert.ok(loopPath.startsWith("%% Decisions made:\n%%   Done? -> No\n%%   Done? -> Yes\nflowchart TD\n"), loopPath);
  // Step: put the default diagram back for later tests.
  await executeExpression("loadDiagram('accountability.mmd')");
  await waitForRender();
});

test("test_exported_path_keeps_props_lines_arrow_labels_and_direction", async () => {
  const source = [
    "flowchart LR",
    '  %% ==props==: {"blockId":"B_START","alignment":"left","note":"kept note"}',
    '  B_START["Start"]',
    '  Q_ASK{"Done?"}',
    '  Q_CHOICE_ASK_YES["Yes"]',
    '  B_END["End"]',
    "  B_START --> Q_ASK",
    '  Q_ASK -- "agreed" --> Q_CHOICE_ASK_YES',
    "  Q_CHOICE_ASK_YES --> B_END",
    "",
  ].join("\n");
  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/label-demo.mmd`, { method: "PUT", body: source });
  await executeExpression("loadDiagram('label-demo.mmd')");
  await waitMilliseconds(500);
  await executeExpression("document.getElementById('exportAllPathsBtn').click()");
  await waitMilliseconds(1500);
  const pathSource = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/label-demo-path-0.mmd`).then((r) => r.text());
  assert.ok(pathSource.includes("flowchart LR\n"), pathSource);
  assert.ok(pathSource.includes('"alignment":"left","note":"kept note"'), pathSource);
  assert.ok(pathSource.includes('Q_ASK -- "agreed" --> Q_CHOICE_ASK_YES'), pathSource);
  // Step: put the default diagram back for later tests.
  await executeExpression("loadDiagram('accountability.mmd')");
  await waitForRender();
});
