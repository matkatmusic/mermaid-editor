import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseEditorGraph } from "./editor-graph-parse.ts";
import { buildSourceWithLinesReplaced } from "./source-edit.ts";

const source = readFileSync(join(import.meta.dirname, "source-edit.ts"), "utf8");

test("test_source_edit_drops_note_lines_above_a_removed_declaration", () => {
  const { graph } = parseEditorGraph('flowchart TD\n  %% ==note==: a\n  B_A["A"]\n  B_B["B"]');
  assert.equal(buildSourceWithLinesReplaced(graph, new Set([2]), []), 'flowchart TD\n  B_B["B"]');
});

test("test_source_edit_builds_a_choice_id_from_the_question_id", () => {
  assert.ok(source.includes("return `Q_CHOICE_${questionId.replace(/^Q_/, '')}_${suffix}`;"));
});
