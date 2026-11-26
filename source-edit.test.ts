import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseEditorGraph } from "./editor-graph-parse.ts";
import { buildSourceWithLinesReplaced, removeOutgoing } from "./source-edit.ts";

const source = readFileSync(join(import.meta.dirname, "source-edit.ts"), "utf8");

// Obsolete: a note is now linked to a block by the id in the note line, not by its position.
// test("test_source_edit_drops_note_lines_above_a_removed_declaration", () => {
//   const { graph } = parseEditorGraph('flowchart TD\n  %% ==note==: a\n  B_A["A"]\n  B_B["B"]');
//   assert.equal(buildSourceWithLinesReplaced(graph, new Set([2]), []), 'flowchart TD\n  B_B["B"]');
// });

test("test_removing_a_block_removes_only_its_props_line", () => {
  const { graph } = parseEditorGraph('flowchart TD\n  %% ==props==: {"blockId":"B_B","note":"for b"}\n  B_A["A"]\n  B_B["B"]\n  %% ==props==: {"blockId":"B_A","note":"for a"}');
  assert.equal(buildSourceWithLinesReplaced(graph, new Set([2]), []), 'flowchart TD\n  %% ==props==: {"blockId":"B_B","note":"for b"}\n  B_B["B"]');
});

test("test_source_edit_keeps_the_props_line_of_a_block_that_is_declared_again", () => {
  const { graph } = parseEditorGraph('flowchart TD\n  %% ==props==: {"blockId":"B_A","note":"for a"}\n  B_A["A"]');
  assert.equal(buildSourceWithLinesReplaced(graph, new Set([2]), ['  B_A["New"]']), 'flowchart TD\n  %% ==props==: {"blockId":"B_A","note":"for a"}\n  B_A["New"]');
});

const declarations = 'flowchart TD\n  Q1{"one"}\n  Q_CHOICE1["yes"]\n  Q2{"two"}\n  Q3{"three"}';

test("test_remove_outgoing_keeps_the_incoming_edge_on_its_own_line", () => {
  // Scenario: the incoming and outgoing edges of the choice are on separate lines; only the outgoing line goes.
  const { graph } = parseEditorGraph(`${declarations}\n  Q1 --> Q_CHOICE1\n  Q_CHOICE1 --> Q2`);
  assert.equal(removeOutgoing("Q_CHOICE1", graph), `${declarations}\n  Q1 --> Q_CHOICE1`);
});

test("test_remove_outgoing_keeps_the_incoming_edge_of_a_chained_line", () => {
  // Scenario: `Q1 --> Q_CHOICE1 --> Q2` is one line; only the Q_CHOICE1 --> Q2 segment goes.
  const { graph } = parseEditorGraph(`${declarations}\n  Q1 --> Q_CHOICE1 --> Q2`);
  assert.equal(removeOutgoing("Q_CHOICE1", graph), `${declarations}\n  Q1 --> Q_CHOICE1`);
});

test("test_remove_outgoing_keeps_the_later_segments_of_a_chained_line", () => {
  // Scenario: `Q_CHOICE1 --> Q2 --> Q3`; the Q2 --> Q3 segment stays.
  const { graph } = parseEditorGraph(`${declarations}\n  Q_CHOICE1 --> Q2 --> Q3`);
  assert.equal(removeOutgoing("Q_CHOICE1", graph), `${declarations}\n  Q2 --> Q3`);
});

test("test_remove_outgoing_keeps_the_label_of_a_kept_chained_segment", () => {
  // Scenario: a labeled segment that stays on the chained line keeps its label.
  const { graph } = parseEditorGraph(`${declarations}\n  Q1 -- "why" --> Q_CHOICE1 --> Q2`);
  assert.equal(removeOutgoing("Q_CHOICE1", graph), `${declarations}\n  Q1 -- "why" --> Q_CHOICE1`);
});

test("test_source_edit_builds_a_choice_id_from_the_question_id", () => {
  assert.ok(source.includes("return `Q_CHOICE_${questionId.replace(/^Q_/, '')}_${suffix}`;"));
});
