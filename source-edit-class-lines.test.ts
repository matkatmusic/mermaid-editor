import { test } from "node:test";
import assert from "node:assert/strict";

import { parseEditorGraph } from "./editor-graph-parse.ts";
import { buildSourceWithLinesReplaced } from "./source-edit.ts";

const THREE_BLOCKS = 'flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]';
const CLASSDEF = "  classDef Action fill:#fc00ff,stroke:#000000";

function buildSourceWithNodesDeleted(source: string, ids: string[]) {
  const { graph } = parseEditorGraph(source);
  const removedLineIndexes = new Set(ids.map((id) => graph.nodes.get(id)!.lineIndex));
  return buildSourceWithLinesReplaced(graph, removedLineIndexes, []);
}

test("test_deleted_node_is_taken_out_of_the_middle_of_a_class_line", () => {
  // Scenario: `class B_A,B_B,B_C Action`; B_B is deleted.
  const result = buildSourceWithNodesDeleted(`${THREE_BLOCKS}\n${CLASSDEF}\n  class B_A,B_B,B_C Action`, ["B_B"]);
  assert.equal(result, `flowchart TD\n  B_A["A"]\n  B_C["C"]\n${CLASSDEF}\n  class B_A,B_C Action`);
});

test("test_deleted_node_is_taken_out_of_the_start_of_a_class_line", () => {
  const result = buildSourceWithNodesDeleted(`${THREE_BLOCKS}\n${CLASSDEF}\n  class B_A,B_B,B_C Action`, ["B_A"]);
  assert.ok(result.endsWith("\n  class B_B,B_C Action"), result);
});

test("test_deleted_node_is_taken_out_of_the_end_of_a_class_line", () => {
  const result = buildSourceWithNodesDeleted(`${THREE_BLOCKS}\n${CLASSDEF}\n  class B_A,B_B,B_C Action`, ["B_C"]);
  assert.ok(result.endsWith("\n  class B_A,B_B Action"), result);
});

test("test_class_line_goes_away_when_its_only_node_is_deleted", () => {
  const result = buildSourceWithNodesDeleted(`${THREE_BLOCKS}\n${CLASSDEF}\n  class B_B Action\n  class B_A,B_C Question`, ["B_B"]);
  assert.equal(result, `flowchart TD\n  B_A["A"]\n  B_C["C"]\n${CLASSDEF}\n  class B_A,B_C Question`);
});

test("test_deleted_node_is_taken_out_of_every_class_line_that_names_it", () => {
  const result = buildSourceWithNodesDeleted(`${THREE_BLOCKS}\n${CLASSDEF}\n  class B_A,B_B Action\n  class B_B,B_C Question`, ["B_B"]);
  assert.ok(result.endsWith("\n  class B_A Action\n  class B_C Question"), result);
});

test("test_node_whose_id_only_starts_with_the_deleted_id_keeps_its_class", () => {
  // Scenario: B_A is deleted; B_AB stays.
  const result = buildSourceWithNodesDeleted('flowchart TD\n  B_A["A"]\n  B_AB["AB"]\n  class B_A,B_AB Action', ["B_A"]);
  assert.ok(result.endsWith("\n  class B_AB Action"), result);
});

test("test_two_deleted_nodes_are_both_taken_out_of_the_class_lines_in_one_edit", () => {
  const result = buildSourceWithNodesDeleted(`${THREE_BLOCKS}\n${CLASSDEF}\n  class B_A,B_B,B_C Action`, ["B_A", "B_C"]);
  assert.ok(result.endsWith("\n  class B_B Action"), result);
});

test("test_class_def_lines_are_never_changed_by_a_delete", () => {
  // Scenario: a classDef line that mentions a deleted id as text stays as it is.
  const classDefMentioningId = "  classDef B_B fill:#ffffff,stroke:#000000";
  const result = buildSourceWithNodesDeleted(`${THREE_BLOCKS}\n${classDefMentioningId}\n  class B_A,B_B Action`, ["B_B"]);
  assert.ok(result.includes(`\n${classDefMentioningId}\n`), result);
});

test("test_node_declared_inline_on_a_removed_edge_line_and_declared_again_keeps_its_size_line", () => {
  // Scenario: `B_A --> B_X["x"]` is removed and B_X is declared again, so B_X stays and so does its size line.
  const { graph } = parseEditorGraph('flowchart TD\n  B_A["A"]\n  B_A --> B_X["x"]\n%% ==size==: B_X 300 100');
  const result = buildSourceWithLinesReplaced(graph, new Set([2]), ['  B_X["x"]']);
  assert.equal(result, 'flowchart TD\n  B_A["A"]\n%% ==size==: B_X 300 100\n  B_X["x"]');
});

test("test_really_deleted_node_still_loses_its_size_line", () => {
  const result = buildSourceWithNodesDeleted('flowchart TD\n  B_A["A"]\n  B_B["B"]\n%% ==size==: B_B 300 100\n%% ==size==: B_A 200 80', ["B_B"]);
  assert.equal(result, 'flowchart TD\n  B_A["A"]\n%% ==size==: B_A 200 80');
});

test("test_node_declared_inline_on_a_removed_edge_line_and_declared_again_keeps_its_class", () => {
  // Scenario: `B_A --> B_X["x"]` is removed and B_X is declared again on its own line, so B_X is not deleted.
  const { graph } = parseEditorGraph('flowchart TD\n  B_A["A"]\n  B_A --> B_X["x"]\n  class B_A,B_X Action');
  const result = buildSourceWithLinesReplaced(graph, new Set([2]), ['  B_X["x"]']);
  assert.ok(result.endsWith("\n  class B_A,B_X Action"), result);
});
