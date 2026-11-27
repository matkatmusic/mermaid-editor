import { test } from "node:test";
import assert from "node:assert/strict";
// import { computeHashPort, findFreePort } from "./browser-harness.ts";
import { findFreePort } from "./browser-harness.ts";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
// import { createServer, type AddressInfo } from "node:net";
import { createServer } from "node:net";
import { createInterface } from "node:readline";
import { waitMilliseconds } from "./cdp.ts";
import { countTestProcesses } from "./test-process-count.ts";

test("test_findFreePort_returns_a_port_that_can_be_opened", async () => {
    // Step 1: ask for a free port.
    const port = await findFreePort();
    // Step 2: open a server on that port.
    const probe = createServer();
    probe.listen(port);
    await once(probe, "listening");
    // Step 3: the server listens, so close it.
    assert.ok(probe.listening);
    probe.close();
});

test("test_registerBrowserHooks_fails_with_the_full_command_without_global_setup", { timeout: 60_000 }, async () => {
    // Step 1: build the environment of a run that has no global setup. NODE_TEST_CONTEXT would stop the child run.
    const childEnvironment = { ...process.env };
    delete childEnvironment.NODE_TEST_CONTEXT;
    delete childEnvironment.SHARED_SERVER_PORT;
    delete childEnvironment.SHARED_CDP_PORT;
    delete childEnvironment.SHARED_DIAGRAMS_DIR;
    // Step 2: run one small browser test file without --test-global-setup and collect its output.
    const child = spawn("node", ["--test", "tests/multi-line-definition-error.test.ts"], { env: childEnvironment });
    let output = "";
    child.stdout.on("data", (chunk) => {
        output += chunk;
    });
    child.stderr.on("data", (chunk) => {
        output += chunk;
    });
    const childClose = once(child, "close");
    let childClosed = false;
    child.once("close", () => {
        childClosed = true;
    });
    // Step 3: until the run ends, record each server and Chrome that it starts.
    const startedCommands: string[] = [];
    while (!childClosed) {
        const listing = spawnSync("ps", ["-Awwo", "pid,ppid,command"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
        const found = countTestProcesses(listing.stdout, child.pid!);
        startedCommands.push(...found.servers.values(), ...found.chromes.values());
        await waitMilliseconds(100);
    }
    // Step 4: the run fails.
    const [exitCode] = await childClose;
    assert.notEqual(exitCode, 0);
    // Step 5: the output holds the command that works.
    assert.ok(output.includes("--test-global-setup=tests/global-browser-setup.ts"), output);
    // Step 6: no server and no Chrome started.
    assert.deepEqual(startedCommands, []);
});

// Disabled for task #128: computeHashPort is unused. Lost: no test shows that it gives a stable port in its range, or different ports for different file names.
// test("test_compute_hash_port_is_stable_and_stays_inside_the_range", () => {
//   const first = computeHashPort("example.test.ts", 20000, 10000);
//   assert.equal(computeHashPort("example.test.ts", 20000, 10000), first);
//   assert.ok(first >= 20000 && first < 30000);
// });
//
// test("test_compute_hash_port_gives_different_files_different_ports", () => {
//   assert.notEqual(computeHashPort("a.test.ts", 20000, 10000), computeHashPort("b.test.ts", 20000, 10000));
// });

// function getFreePort() {
//     return new Promise<number>((resolve) => {
//         const probe = createServer();
//         probe.listen(0, () => {
//             const { port } = probe.address() as AddressInfo;
//             probe.close(() => resolve(port));
//         });
//     });
// }

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

test("test_killWhenParentExits_stops_a_stand_in_when_its_starter_is_killed", { timeout: 30_000 }, async (t) => {
    // Setup: a child process starts a stand-in program, watches it, reports its process number, then stays alive.
    const starterScript = `
        import { spawn } from "node:child_process";
        import { killWhenParentExits } from "./tests/kill-when-parent-exits.ts";
        const standIn = spawn("sleep", ["60"], { stdio: "ignore" });
        killWhenParentExits(standIn.pid);
        console.log(standIn.pid);
        setInterval(() => {}, 1000);
    `;
    const starter = spawn("node", ["--input-type=module", "-e", starterScript], { stdio: ["ignore", "pipe", "inherit"] });
    // Setup: read the process number of the stand-in from the first output line.
    let standInId = 0;
    for await (const line of createInterface({ input: starter.stdout! })) {
        standInId = Number(line);
        break;
    }
    // Cleanup: a failed run must not leave the two programs that this test started.
    t.after(() => {
        starter.kill("SIGKILL");
        if (isRunning(standInId, "sleep 60"))
            process.kill(standInId, "SIGKILL");
    });
    // Check: the stand-in runs before the starter dies.
    assert.ok(isRunning(standInId, "sleep 60"));
    // Action: kill the starter so that it cannot run any cleanup code.
    starter.kill("SIGKILL");
    // Check: the stand-in stops within a few seconds.
    await waitUntilStopped(standInId, "sleep 60");
});

test("test_the_shared_server_and_Chrome_each_have_a_stop_watcher", () => {
    // Setup: the shared server port and the shared Chrome port are known.
    const serverPort = process.env.SHARED_SERVER_PORT;
    const cdpPort = process.env.SHARED_CDP_PORT;
    assert.ok(serverPort, "SHARED_SERVER_PORT is not set");
    assert.ok(cdpPort, "SHARED_CDP_PORT is not set");
    // Action: list every process with its full command.
    const lines = spawnSync("ps", ["-Awwo", "pid=,command="], { encoding: "utf8" }).stdout.split("\n");
    // Check: the shared server runs.
    const serverPattern = new RegExp(`server\\.(js|ts) --port ${serverPort}\\b`);
    const serverLine = lines.find((line) => serverPattern.test(line));
    assert.ok(serverLine, `no server on port ${serverPort}`);
    // Check: the main Chrome process runs.
    const chromeLine = lines.find((line) => line.includes(`--remote-debugging-port=${cdpPort}`) && !line.includes("--type="));
    assert.ok(chromeLine, `no Chrome on port ${cdpPort}`);
    // Check: a stop watcher names each of the two process numbers.
    for (const programLine of [serverLine, chromeLine]) {
        const processId = Number.parseInt(programLine, 10);
        const hasWatcher = lines.some((line) => line.includes("target_start=") && line.trimEnd().endsWith(` ${processId}`));
        assert.ok(hasWatcher, `no stop watcher for process ${processId}`);
    }
});

// Disabled for task #128: it starts a second server and Chrome. Lost: no single test shows that the real server and Chrome stop when their starter is killed.
// test("test_server_and_chrome_exit_when_the_process_that_started_them_is_killed", { timeout: 60_000 }, async (t) => {
//     // Setup: a child process starts the harness, reports the two process numbers, then stays alive.
//     const serverPort = await getFreePort();
//     const cdpPort = await getFreePort();
//     const starterScript = `
//         import { startServerAndChrome } from "./tests/browser-harness.ts";
//         const session = await startServerAndChrome(${serverPort}, ${cdpPort});
//         console.log(JSON.stringify({ serverId: session.serverProc.pid, chromeId: session.chromeProc.pid }));
//         setInterval(() => {}, 1000);
//     `;
//     const starter = spawn("node", ["--input-type=module", "-e", starterScript], { stdio: ["ignore", "pipe", "inherit"] });
//     t.after(() => starter.kill("SIGKILL"));
//     // The harness also prints build output, so take the first line that holds the report.
//     let report = "";
//     for await (const line of createInterface({ input: starter.stdout! })) {
//         if (line.startsWith("{")) {
//             report = line;
//             break;
//         }
//     }
//     const { serverId, chromeId } = JSON.parse(report);
//     const serverMarker = `server.js --port ${serverPort}`;
//     const chromeMarker = `--remote-debugging-port=${cdpPort}`;
//     // Cleanup: a failed run must not leave the two programs that this test started.
//     t.after(() => {
//         if (isRunning(serverId, serverMarker))
//             process.kill(serverId, "SIGKILL");
//         if (isRunning(chromeId, chromeMarker))
//             process.kill(chromeId, "SIGKILL");
//     });
//     // Check: both run before the starter dies.
//     assert.ok(isRunning(serverId, serverMarker));
//     assert.ok(isRunning(chromeId, chromeMarker));
//     // Action: kill the starter so that it cannot run any cleanup code.
//     starter.kill("SIGKILL");
//     // Check: both stop within a few seconds.
//     await waitUntilStopped(serverId, serverMarker);
//     await waitUntilStopped(chromeId, chromeMarker);
// });
