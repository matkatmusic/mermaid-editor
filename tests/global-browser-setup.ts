import { afterAll } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
// import { computeHashPort, startServerAndChrome, type BrowserSession } from "./browser-harness.ts";
import { findFreePort, startServerAndChrome, type BrowserSession } from "./browser-harness.ts";
import { type TestProcesses } from "./test-process-count.ts";

let session: BrowserSession;
let sampler: Worker;

// The samples run in tests/test-process-sampler.ts now. The old code, from when node ran the tests:
// import { execFile } from "node:child_process";
// import { promisify } from "node:util";
// import { countTestProcesses } from "./test-process-count.ts";
// const executeFile = promisify(execFile);
// const foundProcesses: TestProcesses = { servers: new Map(), chromes: new Map() };
// let sampleTimer: NodeJS.Timeout;
// async function collectTestProcesses() {
//     const { stdout } = await executeFile("ps", ["-Awwo", "pid,ppid,command"], { maxBuffer: 16 * 1024 * 1024 });
//     const sampledProcesses = countTestProcesses(stdout, process.pid);
//     for (const [processId, command] of sampledProcesses.servers) {
//         foundProcesses.servers.set(processId, command);
//     }
//     for (const [processId, command] of sampledProcesses.chromes) {
//         foundProcesses.chromes.set(processId, command);
//     }
// }

function receiveSamplerMessage(): Promise<TestProcesses> {
    return new Promise<TestProcesses>((resolve) => {
        sampler.onmessage = (event: MessageEvent<TestProcesses>) => resolve(event.data);
    });
}

function formatProcessCountMessage(foundProcesses: TestProcesses): string {
    const lines = ["The test run must start exactly 1 server and 1 Chrome. Found processes:"];
    for (const [processId, command] of foundProcesses.servers) {
        lines.push(`${processId} ${command}`);
    }
    for (const [processId, command] of foundProcesses.chromes) {
        lines.push(`${processId} ${command}`);
    }
    return lines.join("\n");
}

// Runs once before all test files: one server and one Chrome for the whole run.
export async function globalSetup() {
    // const serverPort = Number(process.env.SERVER_PORT) || computeHashPort("global-browser-setup", 20000, 10000);
    // const cdpPort = Number(process.env.CDP_PORT) || computeHashPort("global-browser-setup", 30000, 10000);
    const serverPort = Number(process.env.SERVER_PORT) || await findFreePort();
    const cdpPort = Number(process.env.CDP_PORT) || await findFreePort();
    // Remove viewer.js so that only the server start can supply it.
    rmSync(join(process.cwd(), "source", "app", "viewer.js"), { force: true });
    session = await startServerAndChrome(serverPort, cdpPort);
    process.env.SHARED_SERVER_PORT = String(session.serverPort);
    process.env.SHARED_CDP_PORT = String(session.cdpPort);
    process.env.SHARED_DIAGRAMS_DIR = session.diagramsCopyDir;
    // await collectTestProcesses();
    // sampleTimer = setInterval(collectTestProcesses, 100);
    sampler = new Worker(new URL("./test-process-sampler.ts", import.meta.url).href);
    // The first message says that the first sample is done.
    await receiveSamplerMessage();
}

export async function globalTeardown() {
    // clearInterval(sampleTimer);
    // await collectTestProcesses();
    const reportReceived = receiveSamplerMessage();
    sampler.postMessage("stop");
    const foundProcesses = await reportReceived;
    sampler.terminate();
    session.chromeProc.kill("SIGKILL");
    session.serverProc.kill();
    if (foundProcesses.servers.size !== 1) {
        console.error(formatProcessCountMessage(foundProcesses));
        process.exitCode = 1;
    }
    if (foundProcesses.chromes.size !== 1) {
        console.error(formatProcessCountMessage(foundProcesses));
        process.exitCode = 1;
    }
}

// bunfig.toml preloads this file, so this code runs once for the whole test run.
// No beforeAll: Bun loads the first test file before that hook, and a test file reads the SHARED values when it loads.
await globalSetup();
afterAll(globalTeardown, 60_000);
