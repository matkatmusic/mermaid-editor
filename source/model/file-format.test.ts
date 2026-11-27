import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSourceWithPropsLines } from "./file-format.ts";

test("test_old_size_align_and_both_note_lines_become_one_props_line_per_block", () => {
    const source = [
        'flowchart TD',
        '  %% ==note==: first',
        '  %% ==note==: second',
        '  B_A["A"]',
        '  B_B["B"]',
        '%% ==size==: B_A 240 80',
        '%% ==align==: B_A left top',
        '%% ==note:[B_B]==: for b',
        '%% ==size==: B_B 100 50',
    ].join('\n');
    assert.equal(buildSourceWithPropsLines(source), [
        'flowchart TD',
        '  %% ==props==: {"blockId":"B_A","alignment":"top","justification":"left","width":240,"height":80,"note":"first<br/>second"}',
        '  B_A["A"]',
        '  %% ==props==: {"blockId":"B_B","width":100,"height":50,"note":"for b"}',
        '  B_B["B"]',
    ].join('\n'));
});

test("test_an_old_note_line_that_is_not_directly_above_a_declaration_stays_a_comment", () => {
    const source = 'flowchart TD\n  %% ==note==: loose\n  %% hi\n  B_A["A"]\n  %% ==note==: at the end';
    assert.equal(buildSourceWithPropsLines(source), source);
});

test("test_old_values_join_the_props_line_the_block_already_has", () => {
    const source = 'flowchart TD\n  %% ==props==: {"blockId":"B_A","note":"n"}\n  B_A["A"]\n%% ==size==: B_A 240 80';
    assert.equal(buildSourceWithPropsLines(source), 'flowchart TD\n  %% ==props==: {"blockId":"B_A","width":240,"height":80,"note":"n"}\n  B_A["A"]');
});
