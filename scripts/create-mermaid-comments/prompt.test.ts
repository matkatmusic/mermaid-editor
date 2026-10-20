import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const promptScriptPath = join(import.meta.dirname, "prompt.ts");
const mermaidEditorDirectory = join(import.meta.dirname, "..", "..");

test("test_prompt_lists_the_file_named_in_the_arguments", () => {
  const output = execFileSync("node", [promptScriptPath, "zoom.ts"], {
    cwd: mermaidEditorDirectory,
    encoding: "utf8",
  });
  assert.ok(output.includes("## Files\n\n- zoom.ts\n"));
});

test("test_prompt_check_step_diffs_the_file_named_in_the_arguments", () => {
  const output = execFileSync("node", [promptScriptPath, "zoom.ts"], {
    cwd: mermaidEditorDirectory,
    encoding: "utf8",
  });
  assert.ok(output.includes("git diff -U0 -- zoom.ts"));
});
