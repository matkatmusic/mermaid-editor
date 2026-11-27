import { test } from "node:test";
import assert from "node:assert/strict";
import { computeHashPort } from "./browser-harness.ts";
import { spawn, spawnSync } from "node:child_process";
import { createServer, type AddressInfo } from "node:net";
import { createInterface } from "node:readline";
import { waitMilliseconds } from "./cdp.ts";

test("test_compute_hash_port_is_stable_and_stays_inside_the_range", () => {
  const first = computeHashPort("example.test.ts", 20000, 10000);
  assert.equal(computeHashPort("example.test.ts", 20000, 10000), first);
  assert.ok(first >= 20000 && first < 30000);
});

test("test_compute_hash_port_gives_different_files_different_ports", () => {
  assert.notEqual(computeHashPort("a.test.ts", 20000, 10000), computeHashPort("b.test.ts", 20000, 10000));
});

function getFreePort() {
    return new Promise<number>((resolve) => {
        const probe = createServer();
        probe.listen(0, () => {
            const { port } = probe.address() as AddressInfo;
            probe.close(() => resolve(port));
        });
    });
}

// The command text must match too, so a reused process number never counts.
function isRunning(processId: number, commandMarker: string) {
    const listing = spawnSync("ps", ["-p", String(processId), "-o", "command="], { encoding: "utf8" });
    return listing.stdout.includes(commandMarker);
}

async function waitUntilStopped(processId: number, commandMarker: string) {
    const deadline = Date.now() + 5000;
    while (isRunning(processId, commandMarker)) {
        assert.ok(Date.now() < deadline, `process ${processId} still runs: ${commandMarker}`);
        await waitMilliseconds(100);
    }
}

test("test_server_and_chrome_exit_when_the_process_that_started_them_is_killed", { timeout: 60_000 }, async (t) => {
    // Setup: a child process starts the harness, reports the two process numbers, then stays alive.
    const serverPort = await getFreePort();
    const cdpPort = await getFreePort();
    const starterScript = `
        import { startServerAndChrome } from "./tests/browser-harness.ts";
        const session = await startServerAndChrome(${serverPort}, ${cdpPort});
        console.log(JSON.stringify({ serverId: session.serverProc.pid, chromeId: session.chromeProc.pid }));
        setInterval(() => {}, 1000);
    `;
    const starter = spawn("node", ["--input-type=module", "-e", starterScript], { stdio: ["ignore", "pipe", "inherit"] });
    t.after(() => starter.kill("SIGKILL"));
    // The harness also prints build output, so take the first line that holds the report.
    let report = "";
    for await (const line of createInterface({ input: starter.stdout! })) {
        if (line.startsWith("{")) {
            report = line;
            break;
        }
    }
    const { serverId, chromeId } = JSON.parse(report);
    const serverMarker = `server.js --port ${serverPort}`;
    const chromeMarker = `--remote-debugging-port=${cdpPort}`;
    // Cleanup: a failed run must not leave the two programs that this test started.
    t.after(() => {
        if (isRunning(serverId, serverMarker))
            process.kill(serverId, "SIGKILL");
        if (isRunning(chromeId, chromeMarker))
            process.kill(chromeId, "SIGKILL");
    });
    // Check: both run before the starter dies.
    assert.ok(isRunning(serverId, serverMarker));
    assert.ok(isRunning(chromeId, chromeMarker));
    // Action: kill the starter so that it cannot run any cleanup code.
    starter.kill("SIGKILL");
    // Check: both stop within a few seconds.
    await waitUntilStopped(serverId, serverMarker);
    await waitUntilStopped(chromeId, chromeMarker);
});
