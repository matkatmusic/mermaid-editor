// import { watch } from "node:fs";
import { watch, type FSWatcher } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

// export function isValidName(name) {
export function isValidName(name: string) {
  return /^[a-zA-Z0-9_-]+\.mmd$/.test(name);
}

// const EDITOR_DIR = import.meta.dir;
const EDITOR_DIR = import.meta.dirname;
const DIAGRAMS_DIR = process.env.DIAGRAMS_DIR ?? resolve(EDITOR_DIR, "..", "..", "..", "diagrams");
const LAST_OPENED_FILE = process.env.LAST_OPENED_FILE ?? resolve(EDITOR_DIR, "..", "..", ".last-opened.json");

const portFlagIndex = process.argv.indexOf("--port");
const PORT = portFlagIndex === -1 ? 0 : Number(process.argv[portFlagIndex + 1]);
const hostnameFlagIndex = process.argv.indexOf("--hostname");
const HOSTNAME = hostnameFlagIndex === -1 ? "0.0.0.0" : process.argv[hostnameFlagIndex + 1];

// let openedFilePath = null; // one path for every tab: a second tab's Open File redirected the first tab's saves
// Paths the server itself got from the native Open File dialog or the last-opened file. A page may only name a path in this set.
// const allowedOpenedPaths = new Set();
const allowedOpenedPaths = new Set<string>();

// function getRequestedOpenedPath(url) {
function getRequestedOpenedPath(url: URL) {
  const requestedPath = url.searchParams.get("path");
  if (requestedPath === null) return null;
  if (!allowedOpenedPaths.has(requestedPath)) return null;
  return requestedPath;
}

// stdout is ignored: the first server output must be the 'Mermaid viewer running at' line.
export function buildViewerBundle() {
    const build = spawnSync("bun", ["build", "viewer.ts", "--outfile", "viewer.js"], { cwd: EDITOR_DIR, stdio: ["ignore", "ignore", "inherit"] });
    if (build.status !== 0)
        throw new Error("viewer.js build failed");
}
if (import.meta.main)
    buildViewerBundle();

const server = import.meta.main && Bun.serve({
  port: PORT,
  hostname: HOSTNAME,
  idleTimeout: 0,
  // async fetch(req) {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      // return new Response(Bun.file(resolve(EDITOR_DIR, "index.html")), { headers: { "Cache-Control": "no-cache" } });
      return new Response('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Mermaid Viewer</title><script src="/mermaid.min.js"></script></head><body class="dark"><script src="viewer.js"></script></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8', "Cache-Control": "no-cache" } });
    }

    if (url.pathname === "/viewer.js") {
      return new Response(Bun.file(resolve(EDITOR_DIR, "viewer.js")), { headers: { "Content-Type": "text/javascript", "Cache-Control": "no-cache" } });
    }

    if (url.pathname === "/mermaid.min.js") {
      return new Response(Bun.file(resolve(EDITOR_DIR, "..", "..", "node_modules/mermaid/dist/mermaid.min.js")), { headers: { "Content-Type": "text/javascript" } });
    }

    if (url.pathname === "/api/diagrams" && req.method === "GET") {
      const glob = new Bun.Glob("*.mmd");
      const names = await Array.fromAsync(glob.scan({ cwd: DIAGRAMS_DIR }));
      return Response.json(names.sort());
    }

    const match = url.pathname.match(/^\/api\/diagrams\/([^/]+)$/);
    if (match) {
      const name = match[1];
      if (!isValidName(name)) {
        return new Response("Invalid diagram name", { status: 400 });
      }
      const file = Bun.file(resolve(DIAGRAMS_DIR, name));

      if (req.method === "GET") {
        if (!(await file.exists())) return new Response("Not found", { status: 404 });
        await Bun.write(LAST_OPENED_FILE, JSON.stringify({ name }));
        return new Response(file, { headers: { "X-Diagram-Path": resolve(DIAGRAMS_DIR, name) } });
      }

      if (req.method === "PUT") {
        const text = await req.text();
        await Bun.write(resolve(DIAGRAMS_DIR, name), text);
        return new Response("OK");
      }
    }

    const watchMatch = url.pathname.match(/^\/api\/watch\/([^/]+)$/);
    if (watchMatch && req.method === "GET") {
      const name = watchMatch[1];
      if (!isValidName(name)) {
        return new Response("Invalid diagram name", { status: 400 });
      }
      const encoder = new TextEncoder();
      // let watcher;
      let watcher: FSWatcher;
      // const stream = new ReadableStream({
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(":ok\n\n"));
          watcher = watch(resolve(DIAGRAMS_DIR, name), () => {
            controller.enqueue(encoder.encode("data: changed\n\n"));
          });
        },
        cancel() {
          watcher.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    if (url.pathname === "/api/open-file" && req.method === "GET") {
      const dialog = Bun.spawn(["osascript", "-e", 'POSIX path of (choose file with prompt "Open diagram")'], { stdout: "pipe", stderr: "pipe" });
      const [stdout, stderr, exitCode] = await Promise.all([new Response(dialog.stdout).text(), new Response(dialog.stderr).text(), dialog.exited]);
      if (exitCode !== 0) {
        const userCanceled = stderr.includes("-128");
        if (userCanceled) return new Response(null, { status: 204 });
        throw new Error(stderr);
      }
      const path = stdout.trim();
      // openedFilePath = path;
      allowedOpenedPaths.add(path);
      await Bun.write(LAST_OPENED_FILE, JSON.stringify({ path }));
      return Response.json({ path, text: await Bun.file(path).text() });
    }

    if (url.pathname === "/api/last-opened" && req.method === "GET") {
      const lastOpened = Bun.file(LAST_OPENED_FILE);
      if (!(await lastOpened.exists())) return new Response(null, { status: 204 });
      // const saved = await lastOpened.json();
      const saved: { name?: string; path: string } = await lastOpened.json();
      if (saved.name) return Response.json(saved);
      // openedFilePath = saved.path;
      allowedOpenedPaths.add(saved.path);
      return Response.json({ path: saved.path, text: await Bun.file(saved.path).text() });
    }

    if (url.pathname === "/api/opened-file" && req.method === "GET") {
      const openedFilePath = getRequestedOpenedPath(url);
      if (openedFilePath === null) return new Response("No file opened", { status: 400 });
      return new Response(Bun.file(openedFilePath));
    }

    if (url.pathname === "/api/watch-opened" && req.method === "GET") {
      const openedFilePath = getRequestedOpenedPath(url);
      if (openedFilePath === null) return new Response("No file opened", { status: 400 });
      const encoder = new TextEncoder();
      // let watcher;
      let watcher: FSWatcher;
      // const stream = new ReadableStream({
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(":ok\n\n"));
          watcher = watch(openedFilePath, () => {
            controller.enqueue(encoder.encode("data: changed\n\n"));
          });
        },
        cancel() {
          watcher.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    if (url.pathname === "/api/open-file" && req.method === "PUT") {
      const openedFilePath = getRequestedOpenedPath(url);
      if (openedFilePath === null) return new Response("No file opened", { status: 400 });
      await Bun.write(openedFilePath, await req.text());
      return new Response("OK");
    }

    return new Response("Not found", { status: 404 });
  },
});

// Chrome's file dialogs need a secure page; localhost counts as secure, 0.0.0.0 does not.
const shownHostname = HOSTNAME === "0.0.0.0" ? "localhost" : HOSTNAME;
// if (import.meta.main) console.log(`Mermaid viewer running at http://${shownHostname}:${server.port}`);
if (server) console.log(`Mermaid viewer running at http://${shownHostname}:${server.port}`);
