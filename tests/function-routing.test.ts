import { test } from "node:test";
import assert from "node:assert/strict";
import { filterToFunctions, isFunctionLabel } from "../function-routing.ts";

const SAMPLE = [
  "flowchart TD",
  '  B_ENTRY["entry point"]',
  '  B_CALLER["caller(x: number)"]',
  '  B_WORK["do work"]',
  '  Q_1{"ready?"}',
  '  Q_CHOICE_1_Y["Yes"]',
  '  B_CALLEE["callee(y: string)"]',
  '  B_HELPER["helper()"]',
  "  B_ENTRY --> B_CALLER",
  "  B_CALLER --> B_WORK",
  "  B_WORK --> Q_1",
  "  Q_1 --> Q_CHOICE_1_Y",
  "  Q_CHOICE_1_Y --> B_CALLEE",
  "  B_CALLEE --> B_HELPER",
].join("\n");

const EXPECTED = [
  "flowchart TD",
  '  B_CALLER["caller(x: number)"]',
  '  B_CALLEE["callee(y: string)"]',
  '  B_HELPER["helper()"]',
  "  B_CALLER --> B_CALLEE",
  "  B_CALLEE --> B_HELPER",
].join("\n");

test("test_isFunctionLabel_matches_call_signatures", () => {
  // A label shaped identifier(...) is a function definition.
  assert.equal(isFunctionLabel("caller(x: number)"), true);
  assert.equal(isFunctionLabel("helper()"), true);
  assert.equal(isFunctionLabel("shouldBlock(marker: string, ...)"), true);
  // Prose and decision labels are not function definitions.
  assert.equal(isFunctionLabel("do work"), false);
  assert.equal(isFunctionLabel("parse (the thing)"), false);
  assert.equal(isFunctionLabel("ready?"), false);
});

test("test_filterToFunctions_keeps_only_function_nodes_and_reroutes_edges", () => {
  // The filter drops every non-function node and reroutes edges directly between function nodes.
  assert.equal(filterToFunctions(SAMPLE), EXPECTED);
});

test("test_filterToFunctions_does_not_bridge_through_a_callee", () => {
  // A caller links only to the function it directly reaches, not to functions its callee reaches.
  const output = filterToFunctions(SAMPLE);
  assert.equal(output.includes("B_CALLER --> B_HELPER"), false);
});
