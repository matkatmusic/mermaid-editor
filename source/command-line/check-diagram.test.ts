import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitMilliseconds } from "../../tests/cdp.ts";

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

function findChromeStartedBy(starterId: number) {
    const listing = spawnSync("ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8" });
    for (const line of listing.stdout.split("\n")) {
        const [processId, parentId] = line.trim().split(/\s+/).map(Number);
        if (parentId === starterId) {
            if (line.includes("check-diagram-chrome-"))
                return processId;
        }
    }
    return 0;
}

test("test_check_diagram_uses_the_given_chrome_and_starts_none", { timeout: 30_000 }, async (t) => {
    // Step 1: the global setup of the test run gives the shared Chrome.
    const sharedPort = process.env.SHARED_CDP_PORT;
    assert.ok(sharedPort, "SHARED_CDP_PORT is not set");
    // Step 2: record the ids of the pages that are open before the command runs.
    const responseBefore = await fetch(`http://localhost:${sharedPort}/json/list`);
    const targetsBefore = (await responseBefore.json()) as { id: string; type: string }[];
    const pageIdsBefore = targetsBefore.filter((target) => target.type === "page").map((target) => target.id);
    // Step 3: start the command on a small valid diagram and collect its output.
    const file = join(mkdtempSync(join(tmpdir(), "check-diagram-")), "test.mmd");
    writeFileSync(file, 'flowchart TD\n  B_A["A"]\n');
    const checker = spawn("bun", [cli, file]);
    t.after(() => checker.kill("SIGKILL"));
    let stdout = "";
    checker.stdout.setEncoding("utf8");
    checker.stdout.on("data", (chunk: string) => {
        stdout += chunk;
    });
    const checkerClose = once(checker, "close");
    let checkerClosed = false;
    checker.once("close", () => {
        checkerClosed = true;
    });
    // Step 4: until the command exits, watch for a Chrome that the command starts.
    let startedChrome = false;
    while (!checkerClosed) {
        if (findChromeStartedBy(checker.pid!) !== 0)
            startedChrome = true;
        await waitMilliseconds(20);
    }
    // Step 5: the command reports that the diagram is correct.
    const [exitCode] = await checkerClose;
    assert.equal(exitCode, 0);
    assert.equal(stdout.trim(), `OK ${file}`);
    // Step 6: the command never started a Chrome of its own.
    assert.equal(startedChrome, false, "the command started its own Chrome");
    // Step 7: the command closed its tab, so no new page is open.
    const responseAfter = await fetch(`http://localhost:${sharedPort}/json/list`);
    const targetsAfter = (await responseAfter.json()) as { id: string; type: string }[];
    const pageIdsAfter = targetsAfter.filter((target) => target.type === "page").map((target) => target.id);
    const newPageIds = pageIdsAfter.filter((pageId) => !pageIdsBefore.includes(pageId));
    assert.deepEqual(newPageIds, []);
});

// Disabled for task #128: it starts a second Chrome. Lost: no test shows that the Chrome of check-diagram stops when check-diagram is killed.
// // The command text must match too, so a reused process number never counts.
// function isRunning(processId: number, commandMarker: string) {
//     const listing = spawnSync("ps", ["-p", String(processId), "-o", "command="], { encoding: "utf8" });
//     return listing.stdout.includes(commandMarker);
// }
//
// test("test_check_diagram_chrome_exits_when_the_checker_is_killed", { timeout: 30_000 }, async (t) => {
//     // Setup: start the checker and wait until its Chrome runs.
//     const file = join(mkdtempSync(join(tmpdir(), "check-diagram-")), "test.mmd");
//     writeFileSync(file, 'flowchart TD\n  B_A["A"]\n');
//     const checker = spawn("bun", [cli, file], { stdio: "ignore" });
//     t.after(() => checker.kill("SIGKILL"));
//     let chromeId = 0;
//     const startDeadline = Date.now() + 5000;
//     while (chromeId === 0) {
//         assert.ok(Date.now() < startDeadline, "the checker did not start Chrome");
//         await waitMilliseconds(50);
//         chromeId = findChromeStartedBy(checker.pid!);
//     }
//     // Cleanup: a failed run must not leave the Chrome that this test started.
//     t.after(() => {
//         if (isRunning(chromeId, "check-diagram-chrome-"))
//             process.kill(chromeId, "SIGKILL");
//     });
//     // Action: kill the checker so that it cannot run any cleanup code.
//     checker.kill("SIGKILL");
//     // Check: Chrome stops within a few seconds.
//     const stopDeadline = Date.now() + 5000;
//     while (isRunning(chromeId, "check-diagram-chrome-")) {
//         assert.ok(Date.now() < stopDeadline, `Chrome ${chromeId} still runs`);
//         await waitMilliseconds(100);
//     }
// });
