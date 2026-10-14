import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "./browser-harness.ts";
import { evaluate, sleep } from "./cdp.ts";

registerBrowserHooks(import.meta.url);

test("test_write_chosen_path_writes_numbered_path_files_next_to_the_diagram", async () => {
  // Scenario: the test server saves into its temp DIAGRAMS_DIR copy, so the real diagrams stay untouched.
  await evaluate("document.getElementById('resetBtn').click()");
  await sleep(300);
  await evaluate(
    "document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_THEM_DONE_SPEAKING_Y\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))"
  );
  await sleep(300);
  // Step: the first Write chosen path click writes accountability-path-0.mmd.
  await evaluate("document.querySelector('#phoneTopBar [data-write-path]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
  await sleep(500);
  const names: string[] = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams`).then((r) => r.json());
  assert.ok(names.includes("accountability-path-0.mmd"), JSON.stringify(names));
  // Step: the file holds only the chosen path, without the untaken choice.
  const pathSource = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/accountability-path-0.mmd`).then((r) => r.text());
  // Step: a top comment lists each decision and its chosen answer.
  assert.ok(pathSource.startsWith("%% Decisions made:\n%%   in my head: are they done speaking? -> Yes\nflowchart TD\n"), pathSource);
  // Step: the source classDef and class lines keep the path's colors.
  assert.ok(pathSource.includes("\n  classDef decision fill:#fff3b0,stroke:#b8860b\n"), pathSource);
  assert.match(pathSource, /^  class \S*\bQ_THEM_DONE_SPEAKING\b\S* decision$/m);
  assert.ok(pathSource.includes("  B_RAISE_ISSUE --> B_SELF_LISTEN"), pathSource);
  assert.ok(pathSource.includes("  Q_THEM_DONE_SPEAKING --> Q_CHOICE_THEM_DONE_SPEAKING_Y"), pathSource);
  assert.ok(!pathSource.includes("Q_CHOICE_THEM_DONE_SPEAKING_N"), pathSource);
  // Step: a second click writes the next number instead of overwriting.
  await evaluate("document.querySelector('#phoneTopBar [data-write-path]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
  await sleep(500);
  const namesAfterSecond: string[] = await fetch(`http://localhost:${SERVER_PORT}/api/diagrams`).then((r) => r.json());
  assert.ok(namesAfterSecond.includes("accountability-path-1.mmd"), JSON.stringify(namesAfterSecond));
  await evaluate("document.getElementById('resetBtn').click()");
  await sleep(300);
});
