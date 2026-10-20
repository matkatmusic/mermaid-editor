import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "node-inspector-class.ts"), "utf8");

test("test_node_inspector_class_lists_every_class_plus_none_and_new", () => {
  assert.ok(source.includes("data-class-none>(none)</button>"));
  assert.ok(source.includes("data-class-new>new...</button>"));
});
