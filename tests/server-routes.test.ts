import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isValidName } from "../server.ts";
import { waitMilliseconds } from "./cdp.ts";

interface LastOpenedDiagram {
    name: string;
}

// The route tests use the one server of the test run, which only the global setup starts.
function getSharedServer() {
    const diagramsDir = process.env.SHARED_DIAGRAMS_DIR;
    if (!diagramsDir) {
        throw new Error("server-routes.test.ts needs the global setup. Run: node --test --test-global-setup=tests/global-browser-setup.ts <file>");
    }
    const baseUrl = `http://localhost:${process.env.SHARED_SERVER_PORT}`;
    const lastOpenedFile = join(diagramsDir, ".last-opened.json");
    return { baseUrl, diagramsDir, lastOpenedFile };
}

test("accepts a plain .mmd name", () => {
    assert.equal(isValidName("my-diagram.mmd"), true);
});

test("rejects a name without .mmd", () => {
    assert.equal(isValidName("my-diagram"), false);
});

test("rejects a name with a path in it", () => {
    assert.equal(isValidName("../secret.mmd"), false);
});

test("last-opened returns the name of the diagram fetched last", async () => {
    const { baseUrl, diagramsDir, lastOpenedFile } = getSharedServer();
    const name = "route-last-opened.mmd";
    writeFileSync(join(diagramsDir, name), "flowchart TD\n  B_A[\"A\"]\n");
    // Step: nothing is opened yet.
    rmSync(lastOpenedFile, { force: true });
    assert.equal((await fetch(`${baseUrl}/api/last-opened`)).status, 204);
    await fetch(`${baseUrl}/api/diagrams/${name}`);
    const lastOpened = (await (await fetch(`${baseUrl}/api/last-opened`)).json()) as LastOpenedDiagram;
    assert.deepEqual(lastOpened, { name });
});

test("watch route still fires after the file is replaced by rename, twice in a row", async (t) => {
    // Scenario: vim saves by writing a temp file then renaming it over the target.
    const { baseUrl, diagramsDir } = getSharedServer();
    const name = "route-watch-rename.mmd";
    const path = join(diagramsDir, name);
    writeFileSync(path, "one");
    const watchResponse = await fetch(`${baseUrl}/api/watch/${name}`);
    const reader = watchResponse.body!.getReader();
    t.after(() => reader.cancel());
    await reader.read();
    for (const text of ["two", "three"]) {
        writeFileSync(`${path}.tmp`, text);
        renameSync(`${path}.tmp`, path);
        const message = await Promise.race([reader.read(), waitMilliseconds(2000).then(() => "timeout" as const)]);
        assert.notEqual(message, "timeout");
        assert.ok(new TextDecoder().decode((message as Exclude<typeof message, string>).value).includes("data: changed"));
    }
});

test("opened-file routes serve the text and fire a change event for the opened path", async (t) => {
    const { baseUrl, lastOpenedFile } = getSharedServer();
    const tempDir = mkdtempSync(join(tmpdir(), "watch-opened-"));
    const openedPath = join(tempDir, "elsewhere.mmd");
    writeFileSync(openedPath, "one");
    writeFileSync(lastOpenedFile, JSON.stringify({ path: openedPath }));
    await fetch(`${baseUrl}/api/last-opened`);
    assert.equal(await (await fetch(`${baseUrl}/api/opened-file?path=${encodeURIComponent(openedPath)}`)).text(), "one");
    const watchResponse = await fetch(`${baseUrl}/api/watch-opened?path=${encodeURIComponent(openedPath)}`);
    const reader = watchResponse.body!.getReader();
    t.after(() => reader.cancel());
    await reader.read();
    writeFileSync(openedPath, "two");
    const message = await Promise.race([reader.read(), waitMilliseconds(2000).then(() => "timeout" as const)]);
    assert.notEqual(message, "timeout");
    assert.ok(new TextDecoder().decode((message as Exclude<typeof message, string>).value).includes("data: changed"));
});

test("a save names its own file, and the server refuses a path it did not learn", async () => {
    const { baseUrl, lastOpenedFile } = getSharedServer();
    const tempDir = mkdtempSync(join(tmpdir(), "named-save-"));
    const firstPath = join(tempDir, "first.mmd");
    const secondPath = join(tempDir, "second.mmd");
    const unknownPath = join(tempDir, "unknown.mmd");
    writeFileSync(firstPath, "first");
    writeFileSync(secondPath, "second");
    writeFileSync(unknownPath, "unknown");
    // The server learns two paths, one after the other, like two tabs that each used Open File.
    writeFileSync(lastOpenedFile, JSON.stringify({ path: firstPath }));
    await fetch(`${baseUrl}/api/last-opened`);
    writeFileSync(lastOpenedFile, JSON.stringify({ path: secondPath }));
    await fetch(`${baseUrl}/api/last-opened`);
    // Each save lands only in the file it names, even though the second path was learned last.
    assert.equal((await fetch(`${baseUrl}/api/open-file?path=${encodeURIComponent(firstPath)}`, { method: "PUT", body: "first saved" })).status, 200);
    assert.equal(readFileSync(firstPath, "utf8"), "first saved");
    assert.equal(readFileSync(secondPath, "utf8"), "second");
    // A save with no path, or with a path the server never learned, fails and writes nothing.
    assert.equal((await fetch(`${baseUrl}/api/open-file`, { method: "PUT", body: "no path" })).status, 400);
    assert.equal((await fetch(`${baseUrl}/api/open-file?path=${encodeURIComponent(unknownPath)}`, { method: "PUT", body: "not allowed" })).status, 400);
    assert.equal(readFileSync(unknownPath, "utf8"), "unknown");
    assert.equal(readFileSync(secondPath, "utf8"), "second");
});
