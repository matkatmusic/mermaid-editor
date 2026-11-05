import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEditorGraph } from "./editor-graph-parse.ts";

const compliant = [
  "flowchart TD",
  '  B_Start["Start"]',
  '  Q_Q1{"Ready?"}',
  '  Q_CHOICE_1["Yes"]',
  "  B_Start --> Q_Q1",
  "  Q_Q1 --> Q_CHOICE_1",
].join("\n");

test("test_parse_editor_graph_reports_no_problems_for_a_compliant_source", () => {
  const { graph, problems } = parseEditorGraph(compliant);
  assert.deepEqual(problems, []);
  assert.equal(graph.nodes.size, 3);
  assert.equal(graph.edges.length, 2);
  assert.equal(graph.nodes.get("Q_CHOICE_1")!.kind, "choice");
});

test("test_parse_editor_graph_reports_a_wrong_prefix", () => {
  const { problems } = parseEditorGraph('flowchart TD\n  X_Bad["Bad"]');
  assert.deepEqual(problems, ['Line 2: id "X_Bad" has a non-compliant prefix; it must use "Q_" with brace shape {} for a decision, "Q_CHOICE" with bracket shape [] for a choice, or "B_" with bracket shape [] for a static block.']);
});

test("test_parse_editor_graph_reports_a_wrong_shape", () => {
  const { problems } = parseEditorGraph('flowchart TD\n  Q_Q1["Ready?"]');
  assert.deepEqual(problems, ['Line 2: id "Q_Q1" is a decision and must use brace shape {} (for example, Q_Q1{"Decision"}).']);
});

test("test_parse_editor_graph_reports_an_inline_declaration_on_an_edge", () => {
  const { problems } = parseEditorGraph('flowchart TD\n  B_A["A"]\n  B_A --> B_B["B"]');
  assert.ok(problems.includes('Line 3: id "B_B" is declared inline on an edge; node declarations must be on their own standalone lines.'));
});

test("test_parse_editor_graph_reports_a_block_that_leads_to_more_than_one_node", () => {
  const { problems } = parseEditorGraph('flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_A --> B_B\n  B_A --> B_C');
  assert.deepEqual(problems, ['Line 5: block "B_A" leads to 2 nodes (B_B, B_C); a block must lead to one node, so the phone view can follow one question at a time.']);
});

test("test_parse_editor_graph_reads_the_note_lines_above_a_declaration", () => {
  const source = 'flowchart TD\n  %% ==note==: a\n  %% ==note==: b\n  B_A["A"]\n  %% hi\n  B_B["B"]';
  const { graph } = parseEditorGraph(source);
  assert.equal(graph.nodes.get("B_A")!.note, "a\nb");
  assert.equal(graph.nodes.get("B_B")!.note, "");
});

test("test_parse_editor_graph_reports_an_undeclared_id", () => {
  const { problems } = parseEditorGraph('flowchart TD\n  B_A["A"]\n  B_A --> B_Missing');
  assert.deepEqual(problems, ['Line 3: id "B_Missing" must be declared on its own standalone line and start with "B_" and use bracket shape [].']);
});
