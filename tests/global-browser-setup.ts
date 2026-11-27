import { execFile } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { computeHashPort, startServerAndChrome, type BrowserSession } from "./browser-harness.ts";
import { countTestProcesses, type TestProcesses } from "./test-process-count.ts";

const executeFile = promisify(execFile);

let session: BrowserSession;
const foundProcesses: TestProcesses = { servers: new Map(), chromes: new Map() };
let sampleTimer: NodeJS.Timeout;

async function collectTestProcesses() {
    const { stdout } = await executeFile("ps", ["-Awwo", "pid,ppid,command"], { maxBuffer: 16 * 1024 * 1024 });
    const sampledProcesses = countTestProcesses(stdout, process.pid);
    for (const [processId, command] of sampledProcesses.servers) {
        foundProcesses.servers.set(processId, command);
    }
    for (const [processId, command] of sampledProcesses.chromes) {
        foundProcesses.chromes.set(processId, command);
    }
}

function formatProcessCountMessage(): string {
    const lines = ["The test run must start exactly 1 server and 1 Chrome. Found processes:"];
    for (const [processId, command] of foundProcesses.servers) {
        lines.push(`${processId} ${command}`);
    }
    for (const [processId, command] of foundProcesses.chromes) {
        lines.push(`${processId} ${command}`);
    }
    return lines.join("\n");
}

// Runs once before all test files (node --test --test-global-setup): one server and one Chrome for the whole run.
export async function globalSetup() {
    const serverPort = Number(process.env.SERVER_PORT) || computeHashPort("global-browser-setup", 20000, 10000);
    const cdpPort = Number(process.env.CDP_PORT) || computeHashPort("global-browser-setup", 30000, 10000);
    // Remove viewer.js so that only the server start can supply it.
    rmSync(join(process.cwd(), "viewer.js"), { force: true });
    session = await startServerAndChrome(serverPort, cdpPort);
    process.env.SHARED_SERVER_PORT = String(session.serverPort);
    process.env.SHARED_CDP_PORT = String(session.cdpPort);
    process.env.SHARED_DIAGRAMS_DIR = session.diagramsCopyDir;
    await collectTestProcesses();
    sampleTimer = setInterval(collectTestProcesses, 100);
}

export async function globalTeardown() {
    clearInterval(sampleTimer);
    await collectTestProcesses();
    session.chromeProc.kill("SIGKILL");
    session.serverProc.kill();
    // No throw here: node then calls globalTeardown again and again, and the run never ends.
    if (foundProcesses.servers.size !== 1) {
        console.error(formatProcessCountMessage());
        process.exitCode = 1;
    }
    if (foundProcesses.chromes.size !== 1) {
        console.error(formatProcessCountMessage());
        process.exitCode = 1;
    }
}
