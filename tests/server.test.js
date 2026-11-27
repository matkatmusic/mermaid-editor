import { test, expect, onTestFinished } from "bun:test";
import { mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isValidName } from "../server.js";
// import { killWhenParentExits } from "./kill-when-parent-exits.ts";
import { startTestServer } from "./start-test-server.js";

test("accepts a plain .mmd name", () => {
  expect(isValidName("my-diagram.mmd")).toBe(true);
});

test("rejects a name without .mmd", () => {
  expect(isValidName("my-diagram")).toBe(false);
});

test("rejects a name with a path in it", () => {
  expect(isValidName("../secret.mmd")).toBe(false);
});

test("last-opened returns the name of the diagram fetched last", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "last-opened-"));
  writeFileSync(join(tempDir, "a.mmd"), "flowchart TD\n  B_A[\"A\"]\n");
  // const serverProcess = Bun.spawn(["bun", "server.js", "--port", "0"], {
  //   stdout: "pipe",
  //   env: { ...process.env, DIAGRAMS_DIR: tempDir, LAST_OPENED_FILE: join(tempDir, ".last-opened.json") },
  // });
  // killWhenParentExits(serverProcess.pid);
  const serverProcess = startTestServer({ DIAGRAMS_DIR: tempDir, LAST_OPENED_FILE: join(tempDir, ".last-opened.json") });
  const startupLine = new TextDecoder().decode((await serverProcess.stdout.getReader().read()).value);
  const baseUrl = startupLine.match(/http:\/\/\S+/)[0];
  expect((await fetch(`${baseUrl}/api/last-opened`)).status).toBe(204);
  await fetch(`${baseUrl}/api/diagrams/a.mmd`);
  expect(await (await fetch(`${baseUrl}/api/last-opened`)).json()).toEqual({ name: "a.mmd" });
  serverProcess.kill();
});

test("watch route still fires after the file is replaced by rename, twice in a row", async () => {
  // Scenario: vim saves by writing a temp file then renaming it over the target.
  const tempDir = mkdtempSync(join(tmpdir(), "watch-rename-"));
  writeFileSync(join(tempDir, "a.mmd"), "one");
  // const serverProcess = Bun.spawn(["bun", "server.js", "--port", "0"], {
  //   stdout: "pipe",
  //   env: { ...process.env, DIAGRAMS_DIR: tempDir, LAST_OPENED_FILE: join(tempDir, ".last-opened.json") },
  // });
  // killWhenParentExits(serverProcess.pid);
  const serverProcess = startTestServer({ DIAGRAMS_DIR: tempDir, LAST_OPENED_FILE: join(tempDir, ".last-opened.json") });
  const startupLine = new TextDecoder().decode((await serverProcess.stdout.getReader().read()).value);
  const baseUrl = startupLine.match(/http:\/\/\S+/)[0];
  const watchResponse = await fetch(`${baseUrl}/api/watch/a.mmd`);
  const reader = watchResponse.body.getReader();
  await reader.read();
  for (const text of ["two", "three"]) {
    writeFileSync(join(tempDir, "a.mmd.tmp"), text);
    renameSync(join(tempDir, "a.mmd.tmp"), join(tempDir, "a.mmd"));
    const message = await Promise.race([reader.read(), Bun.sleep(2000).then(() => "timeout")]);
    expect(message).not.toBe("timeout");
    expect(new TextDecoder().decode(message.value)).toContain("data: changed");
  }
  serverProcess.kill();
});

test("opened-file routes serve the text and fire a change event for the opened path", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "watch-opened-"));
  const openedPath = join(tempDir, "elsewhere.mmd");
  writeFileSync(openedPath, "one");
  writeFileSync(join(tempDir, ".last-opened.json"), JSON.stringify({ path: openedPath }));
  // const serverProcess = Bun.spawn(["bun", "server.js", "--port", "0"], {
  //   stdout: "pipe",
  //   env: { ...process.env, DIAGRAMS_DIR: tempDir, LAST_OPENED_FILE: join(tempDir, ".last-opened.json") },
  // });
  // killWhenParentExits(serverProcess.pid);
  const serverProcess = startTestServer({ DIAGRAMS_DIR: tempDir, LAST_OPENED_FILE: join(tempDir, ".last-opened.json") });
  const startupLine = new TextDecoder().decode((await serverProcess.stdout.getReader().read()).value);
  const baseUrl = startupLine.match(/http:\/\/\S+/)[0];
  await fetch(`${baseUrl}/api/last-opened`);
  expect(await (await fetch(`${baseUrl}/api/opened-file?path=${encodeURIComponent(openedPath)}`)).text()).toBe("one");
  const watchResponse = await fetch(`${baseUrl}/api/watch-opened?path=${encodeURIComponent(openedPath)}`);
  const reader = watchResponse.body.getReader();
  await reader.read();
  writeFileSync(openedPath, "two");
  const message = await Promise.race([reader.read(), Bun.sleep(2000).then(() => "timeout")]);
  expect(message).not.toBe("timeout");
  expect(new TextDecoder().decode(message.value)).toContain("data: changed");
  serverProcess.kill();
});

test("a save names its own file, and the server refuses a path it did not learn", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "named-save-"));
  const firstPath = join(tempDir, "first.mmd");
  const secondPath = join(tempDir, "second.mmd");
  const unknownPath = join(tempDir, "unknown.mmd");
  writeFileSync(firstPath, "first");
  writeFileSync(secondPath, "second");
  writeFileSync(unknownPath, "unknown");
  const lastOpenedFile = join(tempDir, ".last-opened.json");
  // const serverProcess = Bun.spawn(["bun", "server.js", "--port", "0"], {
  //   stdout: "pipe",
  //   env: { ...process.env, DIAGRAMS_DIR: tempDir, LAST_OPENED_FILE: lastOpenedFile },
  // });
  // killWhenParentExits(serverProcess.pid);
  const serverProcess = startTestServer({ DIAGRAMS_DIR: tempDir, LAST_OPENED_FILE: lastOpenedFile });
  const startupLine = new TextDecoder().decode((await serverProcess.stdout.getReader().read()).value);
  const baseUrl = startupLine.match(/http:\/\/\S+/)[0];
  // The server learns two paths, one after the other, like two tabs that each used Open File.
  writeFileSync(lastOpenedFile, JSON.stringify({ path: firstPath }));
  await fetch(`${baseUrl}/api/last-opened`);
  writeFileSync(lastOpenedFile, JSON.stringify({ path: secondPath }));
  await fetch(`${baseUrl}/api/last-opened`);
  // Each save lands only in the file it names, even though the second path was learned last.
  expect((await fetch(`${baseUrl}/api/open-file?path=${encodeURIComponent(firstPath)}`, { method: "PUT", body: "first saved" })).status).toBe(200);
  expect(await Bun.file(firstPath).text()).toBe("first saved");
  expect(await Bun.file(secondPath).text()).toBe("second");
  // A save with no path, or with a path the server never learned, fails and writes nothing.
  expect((await fetch(`${baseUrl}/api/open-file`, { method: "PUT", body: "no path" })).status).toBe(400);
  expect((await fetch(`${baseUrl}/api/open-file?path=${encodeURIComponent(unknownPath)}`, { method: "PUT", body: "not allowed" })).status).toBe(400);
  expect(await Bun.file(unknownPath).text()).toBe("unknown");
  expect(await Bun.file(secondPath).text()).toBe("second");
  serverProcess.kill();
});

// The command text must match too, so a reused process number never counts.
function isRunning(processId, commandMarker) {
  const listing = Bun.spawnSync(["ps", "-p", String(processId), "-o", "command="]);
  return listing.stdout.toString().includes(commandMarker);
}

test("a test server stops when the process that started it is killed", async () => {
  // Setup: a child process starts a server with the shared start function, reports the server's process number, then stays alive.
  const starterScript = `
    // import { killWhenParentExits } from "./tests/kill-when-parent-exits.ts";
    // const server = Bun.spawn(["bun", "server.js", "--port", "0"], { stdout: "ignore" });
    // killWhenParentExits(server.pid);
    import { startTestServer } from "./tests/start-test-server.js";
    const server = startTestServer({});
    console.log(server.pid);
  `;
  const starter = Bun.spawn(["bun", "-e", starterScript], { stdout: "pipe" });
  const serverId = Number(new TextDecoder().decode((await starter.stdout.getReader().read()).value));
  // Cleanup: a failed run must not leave the server that this test started.
  onTestFinished(() => {
    if (isRunning(serverId, "server.js --port 0"))
      process.kill(serverId, "SIGKILL");
  });
  // Check: the server runs before the starter dies.
  expect(isRunning(serverId, "server.js --port 0")).toBe(true);
  // Action: kill the starter so that it cannot run any cleanup code.
  starter.kill("SIGKILL");
  // Check: the server stops within a few seconds.
  const deadline = Date.now() + 4000;
  while (isRunning(serverId, "server.js --port 0")) {
    expect(Date.now()).toBeLessThan(deadline);
    await Bun.sleep(100);
  }
}, 10000);
