import { test } from "node:test";
import assert from "node:assert/strict";
import { countTestProcesses } from "./test-process-count.ts";

test("test_countTestProcesses_counts_each_server_and_each_Chrome_main_process_once", () => {
    // Step 1: give the function a fake ps sample with one server, one Chrome main process, three Chrome helpers, and one unrelated Chrome.
    const runnerProcessId = 100;
    const serverProcessId = 102;
    const chromeMainProcessId = 103;
    const chromeProgram = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    const firstPsLines = [
        "  PID  PPID COMMAND",
        "  100     1 node --test",
        "  101   100 node tests/example.test.ts",
        "  102   101 bun server.js --port 26358",
        `  103   101 ${chromeProgram} --headless=new --remote-debugging-port=36358`,
        `  104   103 ${chromeProgram} --type=renderer --remote-debugging-port=36358`,
        `  105   103 ${chromeProgram} --type=gpu-process --remote-debugging-port=36358`,
        `  106   103 ${chromeProgram} --type=utility --remote-debugging-port=36358`,
        `  200     1 ${chromeProgram} --remote-debugging-port=9222`,
    ];
    const firstCounts = countTestProcesses(firstPsLines.join("\n"), runnerProcessId);
    // Step 2: only the one server and the one Chrome main process of the run are counted.
    assert.deepEqual([...firstCounts.servers.keys()], [serverProcessId]);
    assert.deepEqual([...firstCounts.chromes.keys()], [chromeMainProcessId]);
    // Step 3: a second server under the run raises the server count to two.
    const secondPsLines = [...firstPsLines, "  107   101 bun server.ts --port 0"];
    const secondCounts = countTestProcesses(secondPsLines.join("\n"), runnerProcessId);
    assert.equal(secondCounts.servers.size, 2);
});
