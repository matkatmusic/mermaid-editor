import { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createServer } from "node:net";
import { closeCdp, openCdp, executeExpression, send, waitMilliseconds, waitForFunction, waitForPort } from "./cdp.ts";
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
    probe.listen(port);
  });
}

async function initSetup(fileName: string) {
  // Scenario: start the real server and headless Chrome, then connect via CDP to drive the page like a user.
  SERVER_PORT = Number(process.env.SERVER_PORT) || computeHashPort(fileName, 20000, 10000);
  CDP_PORT = Number(process.env.CDP_PORT) || computeHashPort(fileName, 30000, 10000);
  const [serverPortFree, cdpPortFree] = await Promise.all([isPortFree(SERVER_PORT), isPortFree(CDP_PORT)]);
  const bothPortsFree = serverPortFree && cdpPortFree;
  if (!bothPortsFree) {
    const problems: string[] = [];
    if (!serverPortFree)
      problems.push(`SERVER_PORT ${SERVER_PORT} is busy`);
    if (!cdpPortFree)
      problems.push(`CDP_PORT ${CDP_PORT} is busy`);
    throw new Error(`pick free ports; ${problems.join(", ")}`);
  }
  spawnSync("bun", ["build", "viewer.ts", "--outfile", "viewer.js"], { stdio: "inherit" });
  // The server saves into a temp copy so tests never overwrite the real diagrams.
  const diagramsCopyDir = mkdtempSync(join(tmpdir(), "diagrams-copy-"));
  cpSync(join(process.cwd(), "..", "diagrams"), diagramsCopyDir, { recursive: true });
  serverProc = spawn("bun", ["server.js", "--port", String(SERVER_PORT)], { stdio: "ignore", env: { ...process.env, DIAGRAMS_DIR: diagramsCopyDir } });
  await waitForPort(SERVER_PORT);

  const userDataDir = mkdtempSync(join(tmpdir(), "phone-view-test-"));
  chromeProc = spawn(CHROME_PATH, [
    "--headless=new",
    "--disable-gpu",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
  ], { stdio: "ignore" });
  await waitForPort(CDP_PORT);

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
    chromeProc?.kill("SIGKILL");
    serverProc?.kill();
  };
  after(closeSession);
}
