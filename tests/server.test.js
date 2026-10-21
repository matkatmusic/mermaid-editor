import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
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
