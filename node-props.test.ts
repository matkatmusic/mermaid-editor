import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPropsLine, buildSourceWithNodeProps, parsePropsLine } from "./node-props.ts";
import { buildSourceWithNodeSize } from "./node-size.ts";
import { buildSourceWithNodeAlign } from "./node-align.ts";
import { buildSourceWithCodeTags } from "./label-code.ts";

const BASE = 'flowchart TD\n  B_A["A"]';
const FULL = { blockId: 'B_A', alignment: 'top', justification: 'left', width: 240, height: 80, note: 'n' } as const;
const FULL_LINE = '%% ==props==: {"blockId":"B_A","alignment":"top","justification":"left","width":240,"height":80,"note":"n"}';

test("test_build_props_line_writes_the_fields_in_one_json_line", () => {
    assert.equal(buildPropsLine({ note: 'n', height: 80, width: 240, justification: 'left', alignment: 'top', blockId: 'B_A' }), FULL_LINE);
});

test("test_build_props_line_writes_only_the_fields_the_block_has", () => {
    assert.equal(buildPropsLine({ blockId: 'B_A', width: 240, height: 80, note: undefined }), '%% ==props==: {"blockId":"B_A","width":240,"height":80}');
});

test("test_parse_props_line_reads_an_indented_line", () => {
    assert.deepEqual(parsePropsLine(`  ${FULL_LINE}  `), FULL);
});

test("test_parse_props_line_returns_nothing_for_other_comment_lines", () => {
    assert.equal(parsePropsLine('%% ==size==: B_A 352 154'), null);
});

test("test_note_text_with_commas_braces_and_quotes_survives_a_round_trip", () => {
    const note = 'Text, with {commas} and "quotes" and a \\ backslash';
    assert.equal(parsePropsLine(buildPropsLine({ blockId: 'B_A', note }))!.note, note);
});

test("test_a_new_props_line_goes_directly_above_the_declaration", () => {
    assert.equal(buildSourceWithNodeProps(BASE, 'B_A', { note: 'n' }), 'flowchart TD\n  %% ==props==: {"blockId":"B_A","note":"n"}\n  B_A["A"]');
});

test("test_clearing_the_last_field_removes_the_props_line", () => {
    const source = 'flowchart TD\n  %% ==props==: {"blockId":"B_A","note":"n"}\n  B_A["A"]';
    assert.equal(buildSourceWithNodeProps(source, 'B_A', { note: undefined }), BASE);
});

test("test_setting_the_note_of_a_block_keeps_its_other_fields", () => {
    const source = `flowchart TD\n  ${FULL_LINE}\n  B_A["A"]`;
    assert.equal(buildSourceWithNodeProps(source, 'B_A', { note: 'new' }), `flowchart TD\n  ${FULL_LINE.replace('"n"}', '"new"}')}\n  B_A["A"]`);
});

test("test_setting_the_size_of_a_block_keeps_its_other_fields", () => {
    const source = `flowchart TD\n  ${FULL_LINE}\n  B_A["A"]`;
    const expectedLine = FULL_LINE.replace('"width":240,"height":80', '"width":300,"height":90');
    assert.equal(buildSourceWithNodeSize(source, 'B_A', 300, 90), `flowchart TD\n  ${expectedLine}\n  B_A["A"]`);
});

test("test_setting_the_alignment_of_a_block_keeps_its_other_fields", () => {
    const source = `flowchart TD\n  ${FULL_LINE}\n  B_A["A"]`;
    const expectedLine = FULL_LINE.replace('"alignment":"top","justification":"left"', '"alignment":"bottom","justification":"right"');
    assert.equal(buildSourceWithNodeAlign(source, 'B_A', 'right', 'bottom'), `flowchart TD\n  ${expectedLine}\n  B_A["A"]`);
});

test("test_code_tags_leave_the_props_line_unchanged", () => {
    const line = buildPropsLine({ blockId: 'B_A', note: '```\\na\\nb\\n``` and `c`' });
    assert.equal(buildSourceWithCodeTags(`  ${line}`), `  ${line}`);
});
