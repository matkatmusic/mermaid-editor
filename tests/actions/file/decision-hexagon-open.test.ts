// Retired by the task 87 change: a load no longer rewrites { } decisions to {{ }}, because both shapes stay valid.
// The tests below proved the open-time rewrite (one undoable entry, one save, no loop on a watcher reload).
//
// import { test } from "node:test";
// import assert from "node:assert/strict";
// import { registerBrowserHooks, SERVER_PORT } from "./browser-harness.ts";
// import { executeExpression, waitMilliseconds } from "./cdp.ts";
// import { openEditorDrawer, resetEditorFixture } from "./editor-helpers.ts";
//
// registerBrowserHooks(import.meta.url, openEditorDrawer);
//
// const DIAGRAM_NAME = "hexagon-open.mmd";
//
// function buildSource(decisionDeclaration: string) {
//     return [
//         "flowchart TD",
//         '  B_START["Start"]',
//         `  ${decisionDeclaration}`,
//         '  Q_CHOICE_MOOD_GOOD["Good"]',
//         '  Q_CHOICE_MOOD_BAD["Bad"]',
//         '  B_END["End"]',
//         "  B_START --> Q_MOOD",
//         "  Q_MOOD --> Q_CHOICE_MOOD_GOOD --> B_END",
//         "  Q_MOOD --> Q_CHOICE_MOOD_BAD --> B_END",
//     ].join("\n");
// }
//
// const OLD_SOURCE = buildSource('Q_MOOD{"Mood } and }} more?"}');
// const NEW_SOURCE = buildSource('Q_MOOD{{"Mood } and }} more?"}}');
//
// test("test_loading_a_file_with_brace_decisions_rewrites_them_as_one_undoable_hexagon_entry", ...);
// test("test_loading_a_file_with_brace_decisions_writes_the_hexagon_form_to_disk", ...);
// test("test_loading_a_file_with_hexagon_decisions_adds_no_history_entry_and_no_save", ...);
// test("test_a_disk_change_with_brace_decisions_reloads_and_rewrites_without_a_confirm_and_without_a_loop", ...);
