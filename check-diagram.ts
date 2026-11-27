import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEditorGraph } from "./editor-graph-parse.ts";
import { closeCdp, closeCdpPage, executeExpression, openCdp, waitForPort } from "./tests/cdp.ts";
import { killWhenParentExits } from "./tests/kill-when-parent-exits.ts";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MERMAID_PATH = join(import.meta.dirname, "node_modules/mermaid/dist/mermaid.min.js");

function getFreePort() {
  return new Promise<number>((resolve) => {
    const probe = createServer();
    function reportPort() {
      resolve(port);
    }
    function closeProbe() {
      port = (probe.address() as { port: number }).port;
      probe.close(reportPort);
    }
    let port = 0;
    probe.listen(0, closeProbe);
  });
}

// mermaid.parse needs a DOM (it fails under bun), so run it in headless Chrome.
async function getMermaidProblem(source: string) {
  // A test run sets SHARED_CDP_PORT: use the Chrome of the run and start none.
  const sharedCdpPort = process.env.SHARED_CDP_PORT;
  let cdpPort = Number(sharedCdpPort);
  let userDataDir = "";
  let chrome: ChildProcess | undefined;
  if (!sharedCdpPort) {
    cdpPort = await getFreePort();
    userDataDir = mkdtempSync(join(tmpdir(), "check-diagram-chrome-"));
    chrome = spawn(CHROME_PATH, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDataDir}`], { stdio: "ignore" });
    killWhenParentExits(chrome.pid!);
    await waitForPort(cdpPort);
  }
  await openCdp(cdpPort);
  await executeExpression(readFileSync(MERMAID_PATH, "utf8"));
  const message: string = await executeExpression(`mermaid.parse(${JSON.stringify(source)}).then(() => "", (error) => String(error.message ?? error))`);
  if (sharedCdpPort) {
    await closeCdpPage(cdpPort);
  }
  closeCdp();
  if (!sharedCdpPort) {
    chrome!.kill();
    rmSync(userDataDir, { recursive: true, force: true });
  }
  return message.replace(/\s*\n\s*/g, " ");
}

const file = process.argv[2];
const source = readFileSync(file, "utf8");
const { problems } = parseEditorGraph(source);
const mermaidProblem = await getMermaidProblem(source);
if (mermaidProblem)
  problems.push(`Mermaid: ${mermaidProblem}`);
if (problems.length) {
  console.log(problems.join("\n"));
  process.exit(1);
}
console.log(`OK ${file}`);
process.exit(0);
