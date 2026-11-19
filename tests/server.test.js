import { test, expect } from "bun:test";
import { mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isValidName } from "../server.js";

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
  const serverProcess = Bun.spawn(["bun", "server.js", "--port", "0"], {
    stdout: "pipe",
    env: { ...process.env, DIAGRAMS_DIR: tempDir, LAST_OPENED_FILE: join(tempDir, ".last-opened.json") },
  });
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
  const serverProcess = Bun.spawn(["bun", "server.js", "--port", "0"], {
    stdout: "pipe",
    env: { ...process.env, DIAGRAMS_DIR: tempDir, LAST_OPENED_FILE: join(tempDir, ".last-opened.json") },
  });
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
  const serverProcess = Bun.spawn(["bun", "server.js", "--port", "0"], {
    stdout: "pipe",
    env: { ...process.env, DIAGRAMS_DIR: tempDir, LAST_OPENED_FILE: join(tempDir, ".last-opened.json") },
  });
  const startupLine = new TextDecoder().decode((await serverProcess.stdout.getReader().read()).value);
  const baseUrl = startupLine.match(/http:\/\/\S+/)[0];
  await fetch(`${baseUrl}/api/last-opened`);
  expect(await (await fetch(`${baseUrl}/api/opened-file`)).text()).toBe("one");
  const watchResponse = await fetch(`${baseUrl}/api/watch-opened`);
  const reader = watchResponse.body.getReader();
  await reader.read();
  writeFileSync(openedPath, "two");
  const message = await Promise.race([reader.read(), Bun.sleep(2000).then(() => "timeout")]);
  expect(message).not.toBe("timeout");
  expect(new TextDecoder().decode(message.value)).toContain("data: changed");
  serverProcess.kill();
});
