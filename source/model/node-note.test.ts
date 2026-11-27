import { test } from "node:test";
import assert from "node:assert/strict";

import { parseNoteLine } from "./node-note.ts";

test("test_parse_note_line_reads_the_block_id_and_the_text", () => {
    assert.deepEqual(parseNoteLine('  %% ==note:[B_A]==: ask [again] later  '), { id: 'B_A', text: 'ask [again] later' });
});

test("test_parse_note_line_returns_nothing_for_a_note_line_without_a_block_id", () => {
    assert.equal(parseNoteLine('%% ==note==: a'), null);
});

// Obsolete: the editor writes the note in the props line now.
// test("test_build_note_line_writes_the_format_the_parser_reads", () => {
//     assert.equal(buildNoteLine('B_A', 'a'), '%% ==note:[B_A]==: a');
// });
