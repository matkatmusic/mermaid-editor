import { computeHashPort, startServerAndChrome, type BrowserSession } from "./browser-harness.ts";

let session: BrowserSession;

// Runs once before all test files (node --test --test-global-setup): one server and one Chrome for the whole run.
export async function globalSetup() {
    const serverPort = Number(process.env.SERVER_PORT) || computeHashPort("global-browser-setup", 20000, 10000);
    const cdpPort = Number(process.env.CDP_PORT) || computeHashPort("global-browser-setup", 30000, 10000);
    session = await startServerAndChrome(serverPort, cdpPort);
    process.env.SHARED_SERVER_PORT = String(session.serverPort);
    process.env.SHARED_CDP_PORT = String(session.cdpPort);
    process.env.SHARED_DIAGRAMS_DIR = session.diagramsCopyDir;
}

export async function globalTeardown() {
    session.chromeProc.kill("SIGKILL");
    session.serverProc.kill();
}
