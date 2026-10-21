import { test } from "node:test";
import assert from "node:assert/strict";
import { computeHashPort } from "./browser-harness.ts";

test("test_compute_hash_port_is_stable_and_stays_inside_the_range", () => {
  const first = computeHashPort("example.test.ts", 20000, 10000);
  assert.equal(computeHashPort("example.test.ts", 20000, 10000), first);
  assert.ok(first >= 20000 && first < 30000);
});

test("test_compute_hash_port_gives_different_files_different_ports", () => {
  assert.notEqual(computeHashPort("a.test.ts", 20000, 10000), computeHashPort("b.test.ts", 20000, 10000));
});
