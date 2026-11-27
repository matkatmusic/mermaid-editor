// Disabled: tests/browser-harness.test.ts and check-diagram.test.ts cover the same behaviors.
// import { test } from "node:test";
// import assert from "node:assert/strict";
// import { spawn, spawnSync } from "node:child_process";
// import { once } from "node:events";
// import { mkdtempSync, writeFileSync } from "node:fs";
// import { createServer } from "node:net";
// import { tmpdir } from "node:os";
// import { join } from "node:path";
// import { createInterface } from "node:readline";
// import { waitMilliseconds } from "./cdp.ts";

// const STARTED_PREFIX = "STARTED ";

// interface StartedProcessIds {
//     serverProcessId: number;
//     chromeProcessId: number;
// }

// function getFreePort() {
//     return new Promise<number>((resolve) => {
//         const probe = createServer();
//         function reportPort() {
//             resolve(port);
//         }
//         function closeProbe() {
//             port = (probe.address() as { port: number }).port;
//             probe.close(reportPort);
//         }
//         let port = 0;
//         probe.listen(0, closeProbe);
//     });
// }

// function isProcessRunning(processId: number) {
//     return spawnSync("ps", ["-p", String(processId)]).status === 0;
// }

// async function waitForProcessExit(processId: number) {
//     const start = Date.now();
//     while (Date.now() - start < 5000) {
//         if (!isProcessRunning(processId))
//             return true;
//         await waitMilliseconds(100);
//     }
//     return false;
// }

// function stopLeftoverProcess(processId: number) {
//     if (isProcessRunning(processId))
//         process.kill(processId, "SIGKILL");
// }

// async function startHarnessThenKillIt(): Promise<StartedProcessIds> {
//     const serverPort = await getFreePort();
//     const cdpPort = await getFreePort();
//     const script = `
//         const { startServerAndChrome } = await import("./tests/browser-harness.ts");
//         const session = await startServerAndChrome(${serverPort}, ${cdpPort});
//         console.log("${STARTED_PREFIX}" + JSON.stringify({ serverProcessId: session.serverProc.pid, chromeProcessId: session.chromeProc.pid }));
//         setInterval(() => {}, 1000);
//     `;
//     const child = spawn(process.execPath, ["--input-type=module", "-e", script], { cwd: process.cwd(), stdio: ["ignore", "pipe", "inherit"] });
//     const outputLines = createInterface({ input: child.stdout });
//     for await (const line of outputLines) {
//         if (line.startsWith(STARTED_PREFIX)) {
//             const processIds: StartedProcessIds = JSON.parse(line.slice(STARTED_PREFIX.length));
//             child.kill("SIGKILL");
//             await once(child, "exit");
//             return processIds;
//         }
//     }
//     throw new Error("harness process ended without printing STARTED");
// }

// test("test_server_exits_when_the_process_that_started_it_is_killed", async (t) => {
//     // Step: a separate process starts the server and Chrome, then is killed with no chance to clean up.
//     const { serverProcessId, chromeProcessId } = await startHarnessThenKillIt();
//     // Step: whatever the result, leave no process behind.
//     function stopLeftoverProcesses() {
//         stopLeftoverProcess(serverProcessId);
//         stopLeftoverProcess(chromeProcessId);
//     }
//     t.after(stopLeftoverProcesses);
//     // Step: the server exits on its own.
//     const serverExited = await waitForProcessExit(serverProcessId);
//     assert.ok(serverExited, `server process ${serverProcessId} is still running`);
// });

// test("test_chrome_exits_when_the_process_that_started_it_is_killed", async (t) => {
//     // Step: a separate process starts the server and Chrome, then is killed with no chance to clean up.
//     const { serverProcessId, chromeProcessId } = await startHarnessThenKillIt();
//     // Step: whatever the result, leave no process behind.
//     function stopLeftoverProcesses() {
//         stopLeftoverProcess(serverProcessId);
//         stopLeftoverProcess(chromeProcessId);
//     }
//     t.after(stopLeftoverProcesses);
//     // Step: Chrome exits on its own.
//     const chromeExited = await waitForProcessExit(chromeProcessId);
//     assert.ok(chromeExited, `Chrome process ${chromeProcessId} is still running`);
// });

// test("test_check_diagram_chrome_exits_when_check_diagram_is_killed", async (t) => {
//     // Step: write a small valid diagram.
//     const diagramDir = mkdtempSync(join(tmpdir(), "orphan-diagram-"));
//     const diagramFile = join(diagramDir, "small.mmd");
//     writeFileSync(diagramFile, 'flowchart TD\n  B_A["A"]\n');
//     // Step: start check-diagram on that diagram.
//     const child = spawn("bun", ["check-diagram.ts", diagramFile], { stdio: "ignore" });
//     // Step: wait until check-diagram has started its own Chrome, and record that process id.
//     const start = Date.now();
//     let chromeProcessId = 0;
//     while (Date.now() - start < 5000) {
//         const search = spawnSync("pgrep", ["-P", String(child.pid), "-f", "remote-debugging-port"], { encoding: "utf8" });
//         chromeProcessId = Number(search.stdout.trim().split("\n")[0]);
//         if (chromeProcessId)
//             break;
//         await waitMilliseconds(20);
//     }
//     assert.ok(chromeProcessId, `check-diagram process ${child.pid} started no Chrome`);
//     // Step: whatever the result, leave no process behind.
//     function stopLeftoverChrome() {
//         stopLeftoverProcess(chromeProcessId);
//     }
//     t.after(stopLeftoverChrome);
//     // Step: kill check-diagram while it still runs, so it cannot stop Chrome itself.
//     const childExit = once(child, "exit");
//     child.kill("SIGKILL");
//     const [, exitSignal] = await childExit;
//     assert.equal(exitSignal, "SIGKILL");
//     // Step: Chrome exits on its own.
//     const chromeExited = await waitForProcessExit(chromeProcessId);
//     assert.ok(chromeExited, `Chrome process ${chromeProcessId} is still running`);
// });
