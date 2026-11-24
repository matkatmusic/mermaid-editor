import { test } from "node:test";
import assert from "node:assert/strict";

import { parseEditorGraph } from "./editor-graph-parse.ts";
import { buildSourceWithLinesReplaced } from "./source-edit.ts";
import { buildSourceWithSizeWrappers } from "./node-size.ts";
import { buildAlignLine, buildSourceWithNodeAlign, buildSourceWithoutNodeAlign, getNodeAlign, parseAlignLine } from "./node-align.ts";

const BASE = ['flowchart TD', '  B_A["A"]', '  B_B["B"]', '  B_A --> B_B'].join('\n');

test("test_parse_align_line_reads_the_id_then_justification_then_alignment", () => {
  // Scenario: field order is justification (left/center/right), then alignment (top/center/bottom).
  assert.deepEqual(parseAlignLine('%% ==align==: B_A left bottom'), { id: 'B_A', justification: 'left', alignment: 'bottom' });
});

test("test_parse_align_line_reads_an_indented_line_with_trailing_spaces", () => {
  assert.deepEqual(parseAlignLine('  %% ==align==: B_A right top  '), { id: 'B_A', justification: 'right', alignment: 'top' });
});

test("test_parse_align_line_returns_nothing_for_other_lines_and_swapped_fields", () => {
  assert.equal(parseAlignLine('%% ==align==: B_A top left'), null);
  assert.equal(parseAlignLine('%% ==align==: B_A left'), null);
  assert.equal(parseAlignLine('%% ==size==: B_A 352 154'), null);
  assert.equal(parseAlignLine('%% hello'), null);
});

test("test_get_node_align_reads_the_stored_line_of_the_node", () => {
  const lines = `${BASE}\n%% ==align==: B_A right top\n%% ==align==: B_B left bottom`.split('\n');
  assert.deepEqual(getNodeAlign(lines, 'B_B'), { id: 'B_B', justification: 'left', alignment: 'bottom' });
});

test("test_get_node_align_returns_centre_and_centre_when_the_node_has_no_line", () => {
  assert.deepEqual(getNodeAlign(BASE.split('\n'), 'B_A'), { id: 'B_A', justification: 'center', alignment: 'center' });
});

test("test_build_align_line_writes_the_format_the_parser_reads", () => {
  assert.equal(buildAlignLine('B_A', 'left', 'bottom'), '%% ==align==: B_A left bottom');
});

test("test_build_source_with_node_align_adds_the_line_at_the_end", () => {
  assert.equal(buildSourceWithNodeAlign(BASE, 'B_A', 'left', 'bottom'), `${BASE}\n%% ==align==: B_A left bottom`);
});

test("test_build_source_with_node_align_replaces_the_line_of_the_same_node_and_keeps_the_others", () => {
  const source = `${BASE}\n%% ==align==: B_A right top\n%% ==align==: B_B center bottom`;
  const expected = `${BASE}\n%% ==align==: B_B center bottom\n%% ==align==: B_A left bottom`;
  assert.equal(buildSourceWithNodeAlign(source, 'B_A', 'left', 'bottom'), expected);
});

test("test_build_source_with_node_align_removes_the_line_when_both_values_are_center", () => {
  const source = `${BASE}\n%% ==align==: B_A right top\n%% ==align==: B_B center bottom`;
  assert.equal(buildSourceWithNodeAlign(source, 'B_A', 'center', 'center'), `${BASE}\n%% ==align==: B_B center bottom`);
});

test("test_build_source_with_node_align_adds_no_line_when_both_values_are_center_and_none_is_stored", () => {
  assert.equal(buildSourceWithNodeAlign(BASE, 'B_A', 'center', 'center'), BASE);
});

test("test_build_source_without_node_align_drops_only_the_line_of_that_node", () => {
  const source = `${BASE}\n%% ==align==: B_A right top\n%% ==align==: B_B center bottom`;
  assert.equal(buildSourceWithoutNodeAlign(source, 'B_A'), `${BASE}\n%% ==align==: B_B center bottom`);
});

test("test_removing_a_node_removes_its_align_line", () => {
  const { graph } = parseEditorGraph(`${BASE}\n%% ==align==: B_A right top\n%% ==align==: B_B center bottom`);
  const result = buildSourceWithLinesReplaced(graph, new Set([1, 3]), []);
  assert.equal(result, ['flowchart TD', '  B_B["B"]', '%% ==align==: B_B center bottom'].join('\n'));
});

test("test_a_node_that_stays_keeps_its_align_line_when_a_line_of_it_is_replaced", () => {
  // Scenario: the declaration line of B_A is replaced and written again, so B_A stays and keeps its align line.
  const { graph } = parseEditorGraph(`${BASE}\n%% ==align==: B_A right top`);
  const result = buildSourceWithLinesReplaced(graph, new Set([1]), ['  B_A["A2"]']);
  assert.ok(result.split('\n').includes('%% ==align==: B_A right top'), result);
});

test("test_parse_editor_graph_accepts_an_align_line_without_problems", () => {
  const { problems } = parseEditorGraph(`${BASE}\n%% ==align==: B_A right top`);
  assert.deepEqual(problems, []);
});

const SIZE_STYLE_PREFIX = "display:flex;";

test("test_align_wrapper_of_a_sized_block_moves_the_text_left_and_down", () => {
  // Scenario: left = flex-start across, bottom = flex-end down; the label lines get text-align:left.
  const source = 'flowchart TD\n  B_A["Hello"]\n%% ==size==: B_A 352 154\n%% ==align==: B_A left bottom';
  const style = `${SIZE_STYLE_PREFIX}align-items:flex-end;justify-content:flex-start;width:max(344px,25ch);min-height:max(146px,2lh);white-space:normal;margin:-8px -12px`;
  const expected = `flowchart TD\n  B_A["<div style='${style}'><div style='text-align:left'>Hello</div></div>"]\n%% ==size==: B_A 352 154\n%% ==align==: B_A left bottom`;
  assert.equal(buildSourceWithSizeWrappers(source), expected);
});

test("test_align_wrapper_of_a_sized_block_moves_the_text_right_and_up", () => {
  const source = 'flowchart TD\n  B_A["Hello"]\n%% ==size==: B_A 352 154\n%% ==align==: B_A right top';
  const style = `${SIZE_STYLE_PREFIX}align-items:flex-start;justify-content:flex-end;width:max(344px,25ch);min-height:max(146px,2lh);white-space:normal;margin:-8px -12px`;
  const expected = `flowchart TD\n  B_A["<div style='${style}'><div style='text-align:right'>Hello</div></div>"]\n%% ==size==: B_A 352 154\n%% ==align==: B_A right top`;
  assert.equal(buildSourceWithSizeWrappers(source), expected);
});

test("test_align_wrapper_keeps_the_centre_text_of_a_sized_block_when_only_the_vertical_value_is_set", () => {
  const source = 'flowchart TD\n  B_A["Hello"]\n%% ==size==: B_A 352 154\n%% ==align==: B_A center top';
  const style = `${SIZE_STYLE_PREFIX}align-items:flex-start;justify-content:center;width:max(344px,25ch);min-height:max(146px,2lh);white-space:normal;margin:-8px -12px`;
  assert.ok(buildSourceWithSizeWrappers(source).includes(`B_A["<div style='${style}'><div>Hello</div></div>"]`));
});

test("test_align_wrapper_goes_around_the_label_of_a_sized_hexagon_decision", () => {
  const source = 'flowchart TD\n  Q_A{{"Hi?"}}\n%% ==size==: Q_A 352 154\n%% ==align==: Q_A right bottom';
  const style = `${SIZE_STYLE_PREFIX}align-items:flex-end;justify-content:flex-end;width:max(256px,25ch);min-height:max(106px,2lh);white-space:normal;margin:-11px -12px`;
  assert.ok(buildSourceWithSizeWrappers(source).includes(`Q_A{{"<div style='${style}'><div style='text-align:right'>Hi?</div></div>"}}`));
});

test("test_align_wrapper_of_an_unsized_block_only_sets_the_text_alignment", () => {
  // Scenario: no size line, so no flex box and no minimum size; the text lines are justified inside the label.
  const source = 'flowchart TD\n  B_A["Hello"]\n%% ==align==: B_A right top';
  const expected = `flowchart TD\n  B_A["<div style='margin:-8px -12px;text-align:right'>Hello</div>"]\n%% ==align==: B_A right top`;
  assert.equal(buildSourceWithSizeWrappers(source), expected);
});

test("test_align_wrapper_of_an_unsized_block_that_is_centre_justified_only_gets_the_margin", () => {
  const source = 'flowchart TD\n  B_A["Hello"]\n%% ==align==: B_A center bottom';
  const expected = `flowchart TD\n  B_A["<div style='margin:-8px -12px'>Hello</div>"]\n%% ==align==: B_A center bottom`;
  assert.equal(buildSourceWithSizeWrappers(source), expected);
});
