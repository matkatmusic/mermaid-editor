import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "node-type-colors.ts"), "utf8");

test("test_node_type_colors_reads_the_node_id_with_getNodeId", () => {
  assert.ok(source.includes("graph.nodes.get(getNodeId(nodeEl))"));
});
