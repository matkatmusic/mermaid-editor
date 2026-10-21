import { test } from "node:test";
import assert from "node:assert/strict";
import { waitMilliseconds, waitForPort } from "./cdp.ts";

test("test_wait_milliseconds_waits_at_least_the_given_milliseconds", async () => {
  const start = Date.now();
  await waitMilliseconds(50);
  assert.ok(Date.now() - start >= 45);
});

test("test_wait_for_port_throws_when_nothing_listens_on_the_port", async () => {
  await assert.rejects(waitForPort(1, 300), /port 1 did not open within 300ms/);
});
