import { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createServer } from "node:net";
import { closeCdp, closeCdpPage, openCdp, executeExpression, send, waitMilliseconds, waitForFunction, waitForPort } from "./cdp.ts";
import { EDITOR_FIXTURE_NAME, editorFixtureSource } from "./fixtures.ts";

export let SERVER_PORT: number;
let CDP_PORT: number;
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

let serverProc: ChildProcess;
let chromeProc: ChildProcess;

// ponytail: hash-derived port per test file name, so test files never share ports.
export function computeHashPort(fileName: string, base: number, range: number): number {
  let hash = 0;
  for (let i = 0; i < fileName.length; i++)
    hash = (hash * 31 + fileName.charCodeAt(i)) >>> 0;
  return base + (hash % range);
}

function isPortFree(port: number) {
  return new Promise<boolean>((resolve) => {
    const probe = createServer();
    const reportBusy = () => resolve(false);
    const reportFree = () => resolve(true);
    const closeProbe = () => probe.close(reportFree);
    probe.once("error", reportBusy);
    probe.once("listening", closeProbe);
    probe.listen(port, "0.0.0.0");
  });
}

export interface BrowserSession {
    serverPort: number;
    cdpPort: number;
    diagramsCopyDir: string;
    serverProc: ChildProcess;
    chromeProc: ChildProcess;
}

export async function startServerAndChrome(serverPort: number, cdpPort: number): Promise<BrowserSession> {
    const [serverPortFree, cdpPortFree] = await Promise.all([isPortFree(serverPort), isPortFree(cdpPort)]);
    const bothPortsFree = serverPortFree && cdpPortFree;
    if (!bothPortsFree) {
        const problems: string[] = [];
        if (!serverPortFree)
            problems.push(`SERVER_PORT ${serverPort} is busy`);
        if (!cdpPortFree)
            problems.push(`CDP_PORT ${cdpPort} is busy`);
        throw new Error(`pick free ports; ${problems.join(", ")}`);
    }
    spawnSync("bun", ["build", "viewer.ts", "--outfile", "viewer.js"], { stdio: "inherit" });
    // The server saves into a temp copy so tests never overwrite the real diagrams.
    const diagramsCopyDir = mkdtempSync(join(tmpdir(), "diagrams-copy-"));
    cpSync(join(process.cwd(), "..", "diagrams"), diagramsCopyDir, { recursive: true });
    const serverProc = spawn("bun", ["server.js", "--port", String(serverPort)], { stdio: "ignore", env: { ...process.env, DIAGRAMS_DIR: diagramsCopyDir, LAST_OPENED_FILE: join(diagramsCopyDir, ".last-opened.json") } });
    await waitForPort(serverPort);

    const userDataDir = mkdtempSync(join(tmpdir(), "phone-view-test-"));
    const chromeProc = spawn(CHROME_PATH, [
        "--headless=new",
        "--disable-gpu",
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${userDataDir}`,
    ], { stdio: "ignore" });
    await waitForPort(cdpPort);
    return { serverPort, cdpPort, diagramsCopyDir, serverProc, chromeProc };
}

// Gives every test file the same diagrams the first file saw: removes files tests created, restores files tests changed.
function resetSharedDiagramsDir(diagramsCopyDir: string) {
    for (const entryName of readdirSync(diagramsCopyDir))
        rmSync(join(diagramsCopyDir, entryName), { recursive: true, force: true });
    cpSync(join(process.cwd(), "..", "diagrams"), diagramsCopyDir, { recursive: true });
}

async function initSetup(fileName: string) {
  // Scenario: start the real server and headless Chrome, then connect via CDP to drive the page like a user.
  // With --test-global-setup the server and Chrome already run, so this file only resets the diagrams and opens a page.
  const sharedDiagramsDir = process.env.SHARED_DIAGRAMS_DIR;
  if (sharedDiagramsDir) {
    SERVER_PORT = Number(process.env.SHARED_SERVER_PORT);
    CDP_PORT = Number(process.env.SHARED_CDP_PORT);
    resetSharedDiagramsDir(sharedDiagramsDir);
  } else {
    SERVER_PORT = Number(process.env.SERVER_PORT) || computeHashPort(fileName, 20000, 10000);
    CDP_PORT = Number(process.env.CDP_PORT) || computeHashPort(fileName, 30000, 10000);
    const session = await startServerAndChrome(SERVER_PORT, CDP_PORT);
    serverProc = session.serverProc;
    chromeProc = session.chromeProc;
  }

  await openCdp(CDP_PORT);
  await send("Page.enable");
  await send("Runtime.enable");
  // Tall viewport so the phone frame's bottom buttons aren't below the fold for elementFromPoint checks.
  await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `http://localhost:${SERVER_PORT}` });
  await waitForFunction("loadDiagram");
  // Step: on a fresh page load, the default diagram is already showing.
  const start = Date.now();
  let codeValue = await executeExpression("codeBox.value");
  while (true) {
    const isWithinWait = Date.now() - start < 5000;
    const hasRaiseIssue = codeValue.includes("RAISE_ISSUE");
    const keepWaiting = isWithinWait && !hasRaiseIssue;
    if (!keepWaiting)
      break;
    await waitMilliseconds(100);
    codeValue = await executeExpression("codeBox.value");
  }
  assert.ok(codeValue.includes("RAISE_ISSUE"));
  await executeExpression("loadDiagram('accountability.mmd')");
  await waitMilliseconds(300);
}

function clearSetupFailure() {}

// Each test file calls this once to start its own server and Chrome.
export function registerBrowserHooks(testFileUrl: string, afterSetup?: () => Promise<void>) {
  const fileName = basename(testFileUrl);
  let setupDone: Promise<void> = Promise.resolve();
  const executeSetupAndExtra = async () => {
    await initSetup(fileName);
    if (afterSetup)
      await afterSetup();
  };
  const launchSetup = () => (setupDone = executeSetupAndExtra());
  before(launchSetup, { timeout: 60_000 });

  const closeSession = async () => {
    await setupDone.catch(clearSetupFailure); // after() can run before before() finishes when no test matches
    if (serverProc) {
      const restoreFixture = fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`, { method: "PUT", body: editorFixtureSource, signal: AbortSignal.timeout(2000) });
      await restoreFixture.catch(clearSetupFailure);
    }
    closeCdp();
    if (process.env.SHARED_DIAGRAMS_DIR)
      await closeCdpPage(CDP_PORT);
    chromeProc?.kill("SIGKILL");
    serverProc?.kill();
  };
  after(closeSession);
}
