import { test } from "node:test";
import assert from "node:assert/strict";

import { parseEditorGraph } from "./editor-graph-parse.ts";
import { buildSourceWithLinesReplaced } from "./source-edit.ts";
import { buildSourceWithNodeSize, buildSourceWithoutNodeSize, buildSourceWithSizeWrappers, parseSizeLine } from "./node-size.ts";

const BASE = ['flowchart TD', '  B_A["A"]', '  B_B["B"]', '  B_A --> B_B'].join('\n');
const A_SIZE = '%% ==props==: {"blockId":"B_A","width":352,"height":154}';
const A_SMALL_SIZE = '%% ==props==: {"blockId":"B_A","width":100,"height":100}';
const B_SIZE = '%% ==props==: {"blockId":"B_B","width":200,"height":200}';

test("test_parse_size_line_reads_the_id_width_and_height", () => {
  // Scenario: one size line holds the node id, then the box width and height in px.
  assert.deepEqual(parseSizeLine('%% ==size==: B_A 352 154'), { id: 'B_A', width: 352, height: 154 });
});

test("test_parse_size_line_reads_an_indented_line_with_trailing_spaces", () => {
  assert.deepEqual(parseSizeLine('  %% ==size==: B_A 352 154  '), { id: 'B_A', width: 352, height: 154 });
});

test("test_parse_size_line_returns_nothing_for_other_comment_lines", () => {
  assert.equal(parseSizeLine('%% ==note==: B_A 352 154'), null);
  assert.equal(parseSizeLine('%% hello'), null);
  assert.equal(parseSizeLine('%% ==size==: B_A wide 154'), null);
});

// test("test_build_size_line_writes_the_format_the_parser_reads", () => {
//   assert.equal(buildSizeLine('B_A', 352, 154), '%% ==size==: B_A 352 154');
// });

test("test_build_source_with_node_size_adds_the_line_above_the_declaration", () => {
  const expected = ['flowchart TD', `  ${A_SIZE}`, '  B_A["A"]', '  B_B["B"]', '  B_A --> B_B'].join('\n');
  assert.equal(buildSourceWithNodeSize(BASE, 'B_A', 352, 154), expected);
});

test("test_build_source_with_node_size_replaces_the_line_of_the_same_node_and_keeps_the_others", () => {
  const source = `${BASE}\n${A_SMALL_SIZE}\n${B_SIZE}`;
  const expected = ['flowchart TD', `  ${A_SIZE}`, '  B_A["A"]', '  B_B["B"]', '  B_A --> B_B', B_SIZE].join('\n');
  assert.equal(buildSourceWithNodeSize(source, 'B_A', 352, 154), expected);
});

test("test_parse_editor_graph_stores_the_size_on_the_node", () => {
  const { graph, problems } = parseEditorGraph(`${BASE}\n${A_SIZE}`);
  assert.deepEqual(problems, []);
  assert.deepEqual(graph.nodes.get('B_A')!.size, { width: 352, height: 154 });
  assert.equal(graph.nodes.get('B_B')!.size, undefined);
});

// Obsolete: a props line is JSON, and a broken one throws (no try/catch rule) instead of becoming a "Line N" problem.
// test("test_parse_editor_graph_reports_a_malformed_size_line", () => {
//   const { problems } = parseEditorGraph(`${BASE}\n%% ==size==: B_A wide 154`);
//   assert.equal(problems.length, 1);
//   assert.ok(problems[0].startsWith('Line 5:'), problems[0]);
//   assert.ok(problems[0].includes('size line'), problems[0]);
// });

test("test_parse_editor_graph_throws_on_a_broken_props_line", () => {
  assert.throws(() => parseEditorGraph(`${BASE}\n%% ==props==: {"blockId":"B_A","width":wide,"height":154}`), SyntaxError);
});

test("test_parse_editor_graph_reports_a_size_line_of_an_undeclared_node", () => {
  const { problems } = parseEditorGraph(`${BASE}\n%% ==props==: {"blockId":"B_NOPE","width":352,"height":154}`);
  assert.equal(problems.length, 1);
  assert.ok(problems[0].includes('B_NOPE'), problems[0]);
});

test("test_parse_editor_graph_reports_two_size_lines_for_one_node", () => {
  const { problems } = parseEditorGraph(`${BASE}\n${A_SIZE}\n%% ==props==: {"blockId":"B_A","width":400,"height":200}`);
  assert.equal(problems.length, 1);
  assert.ok(problems[0].startsWith('Line 6:'), problems[0]);
});

test("test_removing_a_node_removes_its_size_line", () => {
  const { graph } = parseEditorGraph(`${BASE}\n${A_SIZE}\n${B_SIZE}`);
  // The edge line goes with the node, as in every real delete route; a kept edge would mean the node stays.
  const result = buildSourceWithLinesReplaced(graph, new Set([1, 3]), []);
  assert.equal(result, ['flowchart TD', '  B_B["B"]', B_SIZE].join('\n'));
});

const SIZED_BLOCK = `flowchart TD\n  B_A["Hello"]\n${A_SIZE}`;
const STYLE = "display:flex;align-items:center;justify-content:center;width:max(344px,25ch);min-height:max(146px,2lh);white-space:normal;margin:-8px -12px";

test("test_size_wrapper_goes_around_the_label_of_a_block", () => {
  // Scenario: wrapper width = node width - 8; wrapper height = node height - 8.
  const expected = `flowchart TD\n  B_A["<div style='${STYLE}'><div>Hello</div></div>"]\n${A_SIZE}`;
  assert.equal(buildSourceWithSizeWrappers(SIZED_BLOCK), expected);
});

test("test_size_wrapper_goes_around_the_label_of_a_hexagon_decision", () => {
  // Scenario: the stored size is the outer box. Outer height = wrapper height + 48; outer width = wrapper width + 8 + 4/7 of the outer height.
  const propsLine = '%% ==props==: {"blockId":"Q_A","width":352,"height":154}';
  const source = `flowchart TD\n  Q_A{{"Hi?"}}\n${propsLine}`;
  const hexagonStyle = "display:flex;align-items:center;justify-content:center;width:max(256px,25ch);min-height:max(106px,2lh);white-space:normal;margin:-11px -12px";
  const expected = `flowchart TD\n  Q_A{{"<div style='${hexagonStyle}'><div>Hi?</div></div>"}}\n${propsLine}`;
  assert.equal(buildSourceWithSizeWrappers(source), expected);
});

test("test_build_source_without_node_size_drops_only_the_line_of_that_node", () => {
  const source = `${BASE}\n${A_SMALL_SIZE}\n${B_SIZE}`;
  assert.equal(buildSourceWithoutNodeSize(source, 'B_A'), `${BASE}\n${B_SIZE}`);
});

test("test_size_wrapper_skips_a_diamond_decision", () => {
  const source = 'flowchart TD\n  Q_A{"Hi?"}\n%% ==props==: {"blockId":"Q_A","width":352,"height":154}';
  assert.equal(buildSourceWithSizeWrappers(source), source);
});

test("test_source_without_size_lines_gets_only_the_negative_margin_around_each_label", () => {
  assert.equal(buildSourceWithSizeWrappers('flowchart TD\n  B_A["A"]'), `flowchart TD\n  B_A["<div style='margin:-8px -12px'>A</div>"]`);
});

test("test_node_without_a_size_line_gets_only_the_negative_margin_when_another_node_has_one", () => {
  const source = `${BASE}\n${A_SIZE}`;
  const result = buildSourceWithSizeWrappers(source).split('\n');
  assert.ok(result[1].includes('<div style='), result[1]);
  assert.equal(result[2], `  B_B["<div style='margin:-8px -12px'>B</div>"]`);
});
