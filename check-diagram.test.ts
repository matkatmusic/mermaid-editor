import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = join(import.meta.dirname, "check-diagram.ts");

function runCli(source: string) {
  const file = join(mkdtempSync(join(tmpdir(), "check-diagram-")), "test.mmd");
  writeFileSync(file, source);
  const result = spawnSync("bun", [cli, file], { encoding: "utf8" });
  return { file, status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("test_check_diagram_prints_ok_and_exits_0_for_a_compliant_file", () => {
  const { file, status, stdout } = runCli('flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_A --> B_B\n');
  assert.equal(status, 0);
  assert.equal(stdout.trim(), `OK ${file}`);
});

test("test_check_diagram_names_the_line_of_a_definition_that_spans_more_than_one_line", () => {
  const { status, stdout } = runCli('flowchart TD\n  B_A["a"]\n  B_LONG["first\nsecond"]\n  B_A --> B_LONG\n');
  assert.equal(status, 1);
  assert.ok(stdout.includes('Line 3: the definition of "B_LONG" must start and end on one line. Its text has a line break.'));
  assert.ok(!stdout.includes("standalone line"));
});

test("test_check_diagram_lists_editor_and_mermaid_problems_and_exits_1", () => {
  const { status, stdout } = runCli('flowchart TD\n  X_Bad["Bad"]\n  B_A --> --> B_B\n');
  assert.equal(status, 1);
  assert.ok(stdout.includes('Line 2: id "X_Bad" has a non-compliant prefix'));
  assert.ok(stdout.includes("Mermaid:"));
  assert.ok(!stdout.startsWith("OK"));
});

test("test_check_diagram_names_the_line_of_a_broken_props_line", () => {
  const { status, stderr } = runCli('flowchart TD\n  %% ==props==: {"blockId":"B_A",}\n  B_A["a"]\n');
  assert.equal(status, 1);
  assert.ok(stderr.includes("Line 2: JSON"), stderr);
});
