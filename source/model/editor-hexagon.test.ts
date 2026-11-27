import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEditorGraph } from "./editor-graph-parse.ts";
import { getDeclarationSuffix, validateDeclaration } from "./editor-parse.ts";
// import { buildSourceWithHexagonDecisions } from "./editor-parse.ts";

function buildSourceWithDecision(declaration: string) {
    return ["flowchart TD", '  B_Start["Start"]', `  ${declaration}`, '  Q_CHOICE_1["Yes"]', "  B_Start --> Q_Q1", "  Q_Q1 --> Q_CHOICE_1"].join("\n");
}

test("test_parse_editor_graph_accepts_a_hexagon_decision_without_problems", () => {
    const { graph, problems } = parseEditorGraph(buildSourceWithDecision('Q_Q1{{"Ready?"}}'));
    assert.deepEqual(problems, []);
    assert.equal(graph.nodes.get("Q_Q1")!.kind, "question");
    assert.equal(graph.nodes.get("Q_Q1")!.label, "Ready?");
    assert.equal(graph.nodes.get("Q_Q1")!.isHexagon, true);
});

test("test_parse_editor_graph_accepts_a_diamond_decision_and_marks_it_not_a_hexagon", () => {
    const { graph, problems } = parseEditorGraph(buildSourceWithDecision('Q_Q1{"Ready?"}'));
    assert.deepEqual(problems, []);
    assert.equal(graph.nodes.get("Q_Q1")!.label, "Ready?");
    assert.equal(graph.nodes.get("Q_Q1")!.isHexagon, false);
});

test("test_parse_editor_graph_keeps_a_closing_brace_inside_a_hexagon_label", () => {
    const { graph, problems } = parseEditorGraph(buildSourceWithDecision('Q_Q1{{"a } b"}}'));
    assert.deepEqual(problems, []);
    assert.equal(graph.nodes.get("Q_Q1")!.label, "a } b");
});

test("test_parse_editor_graph_keeps_two_closing_braces_inside_a_hexagon_label", () => {
    const { graph, problems } = parseEditorGraph(buildSourceWithDecision('Q_Q1{{"x}}y"}}'));
    assert.deepEqual(problems, []);
    assert.equal(graph.nodes.get("Q_Q1")!.label, "x}}y");
});

test("test_parse_editor_graph_keeps_a_label_that_ends_with_closing_braces", () => {
    const { graph, problems } = parseEditorGraph(buildSourceWithDecision('Q_Q1{{"ends }}"}}'));
    assert.deepEqual(problems, []);
    assert.equal(graph.nodes.get("Q_Q1")!.label, "ends }}");
});

test("test_parse_editor_graph_keeps_two_closing_braces_inside_a_diamond_label", () => {
    const { graph, problems } = parseEditorGraph(buildSourceWithDecision('Q_Q1{"x}}y"}'));
    assert.deepEqual(problems, []);
    assert.equal(graph.nodes.get("Q_Q1")!.label, "x}}y");
});

test("test_get_declaration_suffix_writes_a_hexagon_decision_as_a_hexagon", () => {
    const { graph } = parseEditorGraph(buildSourceWithDecision('Q_Q1{{"Ready?"}}'));
    assert.equal(getDeclarationSuffix(graph.nodes.get("Q_Q1")!), '{{"Ready?"}}');
});

test("test_get_declaration_suffix_writes_a_diamond_decision_as_a_diamond", () => {
    const { graph } = parseEditorGraph(buildSourceWithDecision('Q_Q1{"Ready?"}'));
    assert.equal(getDeclarationSuffix(graph.nodes.get("Q_Q1")!), '{"Ready?"}');
});

// Retired by the task 87 change: nothing rewrites { } to {{ }}.
// test("test_build_source_with_hexagon_decisions_rewrites_a_brace_decision", ...);
// test("test_build_source_with_hexagon_decisions_leaves_an_existing_hexagon_unchanged", ...);
// test("test_build_source_with_hexagon_decisions_keeps_closing_braces_inside_the_label", ...);
// test("test_build_source_with_hexagon_decisions_leaves_blocks_choices_edges_and_notes_unchanged", ...);

test("test_validate_declaration_message_for_a_decision_names_both_decision_shapes", () => {
    const problems: string[] = [];
    validateDeclaration("Q_Q1", "rect", 2, problems);
    assert.deepEqual(problems, ['Line 2: id "Q_Q1" is a decision and must use diamond shape {} or hexagon shape {{}} (for example, Q_Q1{{"Decision"}}).']);
});

test("test_validate_declaration_accepts_the_hexagon_shape_for_a_decision", () => {
    const problems: string[] = [];
    validateDeclaration("Q_Q1", "hexagon", 2, problems);
    assert.deepEqual(problems, []);
});

test("test_validate_declaration_rejects_the_hexagon_shape_for_a_block", () => {
    const problems: string[] = [];
    validateDeclaration("B_A", "hexagon", 2, problems);
    assert.equal(problems.length, 1);
});
