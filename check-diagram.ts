import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEditorGraph } from "./editor-graph-parse.ts";
import { closeCdp, executeExpression, openCdp, waitForPort } from "./tests/cdp.ts";

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
  const cdpPort = await getFreePort();
  const userDataDir = mkdtempSync(join(tmpdir(), "check-diagram-chrome-"));
  const chrome = spawn(CHROME_PATH, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDataDir}`], { stdio: "ignore" });
  await waitForPort(cdpPort);
  await openCdp(cdpPort);
  await executeExpression(readFileSync(MERMAID_PATH, "utf8"));
  const message: string = await executeExpression(`mermaid.parse(${JSON.stringify(source)}).then(() => "", (error) => String(error.message ?? error))`);
  closeCdp();
  chrome.kill();
  rmSync(userDataDir, { recursive: true, force: true });
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
