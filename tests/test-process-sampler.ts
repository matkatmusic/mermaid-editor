// A worker thread: a test that blocks the test thread (spawnSync) does not stop these samples.
import { spawnSync } from "node:child_process";
import { countTestProcesses, type TestProcesses } from "./test-process-count.ts";

declare const self: Worker;

const foundProcesses: TestProcesses = { servers: new Map(), chromes: new Map() };

function collectTestProcesses() {
    const { stdout } = spawnSync("ps", ["-Awwo", "pid,ppid,command"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    const sampledProcesses = countTestProcesses(stdout, process.pid);
    for (const [processId, command] of sampledProcesses.servers) {
        foundProcesses.servers.set(processId, command);
    }
    for (const [processId, command] of sampledProcesses.chromes) {
        foundProcesses.chromes.set(processId, command);
    }
}

collectTestProcesses();
const sampleTimer = setInterval(collectTestProcesses, 100);

// Any message ends the samples and asks for the result.
function reportTestProcesses() {
    clearInterval(sampleTimer);
    collectTestProcesses();
    self.postMessage(foundProcesses);
}

self.onmessage = reportTestProcesses;
self.postMessage(foundProcesses);
