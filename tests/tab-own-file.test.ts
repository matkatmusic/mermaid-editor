import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { computeHashPort, registerBrowserHooks, SERVER_PORT } from "./browser-harness.ts";
import { executeExpression, send, waitForFunction, waitMilliseconds } from "./cdp.ts";
import { EDITOR_FIXTURE_NAME } from "./fixtures.ts";

registerBrowserHooks(import.meta.url);

const CDP_PORT = Number(process.env.SHARED_CDP_PORT) || Number(process.env.CDP_PORT) || computeHashPort(basename(import.meta.url), 30000, 10000);
const SHARED_DIAGRAMS_DIR = process.env.SHARED_DIAGRAMS_DIR!;

interface SecondPage {
    // evaluate: (expression: string) => Promise<any>;
    evaluate: (expression: string) => Promise<string>;
    close: () => Promise<void>;
}

// A second browser tab on the same Chrome, with its own CDP connection.
async function openSecondPage(): Promise<SecondPage> {
    // const target = await (await fetch(`http://localhost:${CDP_PORT}/json/new?about:blank`, { method: "PUT" })).json();
    const target = await (await fetch(`http://localhost:${CDP_PORT}/json/new?about:blank`, { method: "PUT" })).json() as { id: string; webSocketDebuggerUrl: string };
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener("error", reject, { once: true });
    });
    let nextId = 1;
    // const pending = new Map<number, (result: any) => void>();
    const pending = new Map<number, (result: unknown) => void>();
    socket.addEventListener("message", (event) => {
        // const message = JSON.parse(event.data as string);
        const message = JSON.parse(event.data as string) as { id: number; result: unknown };
        if (pending.has(message.id)) {
            pending.get(message.id)!(message.result);
            pending.delete(message.id);
        }
    });
    // A tab that never answers (a native dialog blocks it) must fail the call, not wait forever.
    // const sendToPage = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolve, reject) => {
    const sendToPage = <Result = unknown>(method: string, params: Record<string, unknown> = {}) => new Promise<Result>((resolve, reject) => {
        const id = nextId++;
        // pending.set(id, resolve);
        pending.set(id, resolve as (result: unknown) => void);
        setTimeout(() => {
            if (pending.delete(id))
                reject(new Error(`CDP ${method} got no reply within 15000ms`));
        }, 15000).unref();
        socket.send(JSON.stringify({ id, method, params }));
    });
    // const evaluate = async (expression: string) => (await sendToPage("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
    const evaluate = async (expression: string) => (await sendToPage<{ result: { value: string } }>("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
    const close = async () => {
        socket.close();
        await fetch(`http://localhost:${CDP_PORT}/json/close/${target.id}`, { signal: AbortSignal.timeout(5000) });
    };
    const page = { evaluate, close };
    // Registered before any await that can hang: an open socket keeps the test process alive after the tests end.
    openedPages.push(page);
    await sendToPage("Page.enable");
    await sendToPage("Runtime.enable");
    await sendToPage("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
    await sendToPage("Page.navigate", { url: `http://localhost:${SERVER_PORT}` });
    for (let i = 0; i < 100; i++) {
        if (await evaluate("typeof loadDiagram") === "function")
            break;
        await waitMilliseconds(50);
    }
    await waitMilliseconds(800);
    return page;
}

// A failed assertion must not leave a tab connection open, or the test process never exits.
const openedPages: SecondPage[] = [];
afterEach(async () => {
    for (const page of openedPages.splice(0))
        await page.close();
});

async function reloadFirstPage() {
    await send("Page.reload");
    await waitMilliseconds(300);
    await waitForFunction("loadDiagram");
    await waitMilliseconds(1000);
}

// The server only reads and writes a path it got from the Open dialog or the last-opened file; this seeds it the second way.
async function allowServerToUsePath(path: string) {
    writeFileSync(join(SHARED_DIAGRAMS_DIR, ".last-opened.json"), JSON.stringify({ path }));
    await fetch(`http://localhost:${SERVER_PORT}/api/last-opened`);
}

function makeDiagramFile(directory: string, fileName: string, nodeId: string) {
    const path = join(directory, fileName);
    writeFileSync(path, `flowchart TD\n  ${nodeId}["${nodeId}"]\n`);
    return path;
}

test("test_each_tab_keeps_shows_and_saves_its_own_opened_file", async () => {
    // Step: two files on disk; the server may use both paths.
    const directory = mkdtempSync(join(tmpdir(), "tab-own-file-"));
    const file1 = makeDiagramFile(directory, "file1.mmd", "B_FILE_ONE");
    const file2 = makeDiagramFile(directory, "file2.mmd", "B_FILE_TWO");
    await allowServerToUsePath(file1);
    await allowServerToUsePath(file2);
    // Step: tab A opens file1; tab B opens file2.
    const tabB = await openSecondPage();
    await executeExpression(`showOpenedFile(${JSON.stringify(file1)}, ${JSON.stringify(readFileSync(file1, "utf8"))})`);
    await tabB.evaluate(`showOpenedFile(${JSON.stringify(file2)}, ${JSON.stringify(readFileSync(file2, "utf8"))})`);
    await waitMilliseconds(1000);
    // Step: each tab shows its own file, text and name.
    assert.match(await executeExpression("codeBox.value"), /B_FILE_ONE/);
    assert.equal(await executeExpression("document.getElementById('status').textContent"), file1);
    assert.match(await tabB.evaluate("codeBox.value"), /B_FILE_TWO/);
    assert.equal(await tabB.evaluate("document.getElementById('status').textContent"), file2);
    // Step: an edit saved in tab A writes only file1.
    await executeExpression("codeBox.value += '\\n  B_EDIT_IN_A[\"edit\"]'; document.getElementById('saveBtn').click()");
    await waitMilliseconds(800);
    assert.match(readFileSync(file1, "utf8"), /B_EDIT_IN_A/);
    assert.doesNotMatch(readFileSync(file2, "utf8"), /B_EDIT_IN_A/);
    // Step: a change of file2 on disk reaches tab B only.
    writeFileSync(file2, 'flowchart TD\n  B_FILE_TWO_CHANGED["changed on disk"]\n');
    await waitMilliseconds(1000);
    assert.match(await tabB.evaluate("codeBox.value"), /B_FILE_TWO_CHANGED/);
    assert.doesNotMatch(await executeExpression("codeBox.value"), /B_FILE_TWO_CHANGED/);
    // Step: reloading tab A keeps file1 (tab B's open does not take over).
    await reloadFirstPage();
    assert.match(await executeExpression("codeBox.value"), /B_FILE_ONE/);
    assert.doesNotMatch(await executeExpression("codeBox.value"), /B_FILE_TWO/);
});

test("test_a_reloaded_tab_keeps_its_own_named_diagram", async () => {
    // Step: tab A opens one diagram of the diagrams folder; tab B opens another.
    const tabB = await openSecondPage();
    await executeExpression("loadDiagram('accountability.mmd')");
    await tabB.evaluate(`loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`);
    await waitMilliseconds(1000);
    // Step: reloading tab A shows accountability.mmd again, not the file tab B opened last.
    await reloadFirstPage();
    assert.match(await executeExpression("codeBox.value"), /RAISE_ISSUE/);
});

test("test_two_tabs_on_the_same_file_both_get_the_live_reload", async () => {
    // Step: one file on disk, opened in two tabs.
    const directory = mkdtempSync(join(tmpdir(), "tab-same-file-"));
    const file = makeDiagramFile(directory, "shared.mmd", "B_SHARED_BEFORE");
    await allowServerToUsePath(file);
    const tabB = await openSecondPage();
    const fileText = JSON.stringify(readFileSync(file, "utf8"));
    await executeExpression(`showOpenedFile(${JSON.stringify(file)}, ${fileText})`);
    await tabB.evaluate(`showOpenedFile(${JSON.stringify(file)}, ${fileText})`);
    await waitMilliseconds(1000);
    // Step: the file changes on disk.
    writeFileSync(file, 'flowchart TD\n  B_SHARED_AFTER["after"]\n');
    await waitMilliseconds(1000);
    // Step: both tabs show the new text.
    assert.match(await executeExpression("codeBox.value"), /B_SHARED_AFTER/);
    assert.match(await tabB.evaluate("codeBox.value"), /B_SHARED_AFTER/);
});

test("test_a_new_tab_with_no_history_opens_what_a_fresh_page_opens", async () => {
    // Step: the last diagram opened by any tab is accountability.mmd.
    await executeExpression("loadDiagram('accountability.mmd')");
    await waitMilliseconds(500);
    // Step: a new tab has no session history, so it opens that diagram.
    const tabB = await openSecondPage();
    assert.match(await tabB.evaluate("codeBox.value"), /RAISE_ISSUE/);
});

test("test_task_93_edits_after_new_and_save_as_go_to_the_new_file_even_when_another_tab_opens_the_old_file", async () => {
    // Step: the big file v1 is open in tab A, by path.
    const directory = mkdtempSync(join(tmpdir(), "task-93-"));
    const fileV1 = makeDiagramFile(directory, "v1.mmd", "B_BIG_FILE");
    const v1Bytes = readFileSync(fileV1, "utf8");
    await allowServerToUsePath(fileV1);
    await executeExpression(`showOpenedFile(${JSON.stringify(fileV1)}, ${JSON.stringify(v1Bytes)})`);
    await waitMilliseconds(800);
    // Step: File > New in tab A; the Save As picker is a stub that records what the handle receives.
    await executeExpression(`(() => {
        window.confirm = () => true;
        window.handleWrites = [];
        window.showSaveFilePicker = async () => ({ name: 'v2.mmd', createWritable: async () => ({ write: async (text) => { window.handleWrites.push(text); }, close: async () => {} }) });
        document.getElementById('newBtn').click();
    })()`);
    await waitMilliseconds(800);
    // Step: the new diagram is edited and saved with Save As; the handle gets the text.
    await executeExpression("codeBox.value += '\\n  B_V2_FIRST[\"first\"]'; document.getElementById('saveBtn').click()");
    await waitMilliseconds(800);
    assert.equal(await executeExpression("window.handleWrites.length"), 1);
    // Step: tab B opens the big file v1 (the server's last opened file is now v1).
    const tabB = await openSecondPage();
    await allowServerToUsePath(fileV1);
    await tabB.evaluate(`showOpenedFile(${JSON.stringify(fileV1)}, ${JSON.stringify(v1Bytes)})`);
    await waitMilliseconds(800);
    // Step: tab A edits the new diagram again and saves.
    await executeExpression("codeBox.value += '\\n  B_V2_SECOND[\"second\"]'; document.getElementById('saveBtn').click()");
    await waitMilliseconds(800);
    // Step: the second save went to the Save As handle, and v1 on disk still holds its original bytes.
    assert.equal(await executeExpression("window.handleWrites.length"), 2);
    assert.match(await executeExpression("window.handleWrites[1]"), /B_V2_SECOND/);
    assert.equal(readFileSync(fileV1, "utf8"), v1Bytes);
});

test("test_task_93_each_open_replaces_the_save_target_and_a_save_writes_only_the_file_shown", async () => {
    // Step: two path files and one named diagram.
    const directory = mkdtempSync(join(tmpdir(), "task-93-open-"));
    const file1 = makeDiagramFile(directory, "one.mmd", "B_ONE");
    const file2 = makeDiagramFile(directory, "two.mmd", "B_TWO");
    const bytes1 = readFileSync(file1, "utf8");
    const bytes2 = readFileSync(file2, "utf8");
    await allowServerToUsePath(file1);
    await allowServerToUsePath(file2);
    // Step: open file1, then file2, in the same tab; edit and save.
    await executeExpression(`showOpenedFile(${JSON.stringify(file1)}, ${JSON.stringify(bytes1)})`);
    await waitMilliseconds(500);
    await executeExpression(`showOpenedFile(${JSON.stringify(file2)}, ${JSON.stringify(bytes2)})`);
    await waitMilliseconds(500);
    await executeExpression("codeBox.value += '\\n  B_EDIT_AFTER_SECOND_OPEN[\"edit\"]'; document.getElementById('saveBtn').click()");
    await waitMilliseconds(800);
    assert.match(readFileSync(file2, "utf8"), /B_EDIT_AFTER_SECOND_OPEN/);
    assert.equal(readFileSync(file1, "utf8"), bytes1);
    // Step: a disk change of file1, which is no longer shown, does not reach the page.
    writeFileSync(file1, 'flowchart TD\n  B_ONE_CHANGED["changed"]\n');
    await waitMilliseconds(1000);
    assert.doesNotMatch(await executeExpression("codeBox.value"), /B_ONE_CHANGED/);
    // Step: open a named diagram; an edit goes to it and to neither path file.
    const file1Bytes = readFileSync(file1, "utf8");
    const file2Bytes = readFileSync(file2, "utf8");
    await executeExpression(`loadDiagram(${JSON.stringify(EDITOR_FIXTURE_NAME)})`);
    await waitMilliseconds(800);
    await executeExpression("codeBox.value += '\\n  B_EDIT_IN_NAMED[\"edit\"]'; document.getElementById('saveBtn').click()");
    await waitMilliseconds(800);
    const namedOnDisk = await (await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${EDITOR_FIXTURE_NAME}`)).text();
    assert.match(namedOnDisk, /B_EDIT_IN_NAMED/);
    assert.equal(readFileSync(file1, "utf8"), file1Bytes);
    assert.equal(readFileSync(file2, "utf8"), file2Bytes);
});

// Holds every reload of the opened file's disk text until the test releases it.
async function holdOpenedFileReloads() {
    await executeExpression(`(() => {
        window.heldReloads = [];
        window.confirmCalls = 0;
        window.confirm = () => { window.confirmCalls++; return true; };
        window.realFetch = window.fetch;
        window.fetch = (url, options) => {
            if (String(url).includes('/api/opened-file'))
                return new Promise((resolve) => window.heldReloads.push(resolve));
            return window.realFetch(url, options);
        };
    })()`);
}

afterEach(async () => {
    await executeExpression("if (window.realFetch) { window.fetch = window.realFetch; window.realFetch = null; }");
});

test("test_task_92_a_reload_started_before_file_new_does_not_replace_the_new_document", async () => {
    // Step: a path file is open and its watcher is running.
    const directory = mkdtempSync(join(tmpdir(), "task-92-new-"));
    const file = makeDiagramFile(directory, "old.mmd", "B_OLD_FILE");
    await allowServerToUsePath(file);
    await executeExpression(`showOpenedFile(${JSON.stringify(file)}, ${JSON.stringify(readFileSync(file, "utf8"))})`);
    await waitMilliseconds(800);
    // Step: the file changes on disk; the reload starts and is held.
    await holdOpenedFileReloads();
    writeFileSync(file, 'flowchart TD\n  B_OLD_FILE_CHANGED["changed"]\n');
    await waitMilliseconds(800);
    assert.equal(await executeExpression("window.heldReloads.length"), 1);
    // Step: File > New.
    await executeExpression("document.getElementById('newBtn').click()");
    await waitMilliseconds(500);
    // Step: the held reload arrives with the old file's changed text.
    await executeExpression("window.heldReloads.shift()(new Response('flowchart TD\\n  B_OLD_FILE_CHANGED[\"changed\"]\\n'))");
    await waitMilliseconds(500);
    // Step: the new document stays and no question shows.
    assert.match(await executeExpression("codeBox.value"), /B_NEW/);
    assert.doesNotMatch(await executeExpression("codeBox.value"), /B_OLD_FILE_CHANGED/);
    assert.equal(await executeExpression("window.confirmCalls"), 0);
});

test("test_task_92_a_reload_started_before_open_file_does_not_replace_the_next_file", async () => {
    // Step: file1 is open and its watcher is running.
    const directory = mkdtempSync(join(tmpdir(), "task-92-open-"));
    const file1 = makeDiagramFile(directory, "first.mmd", "B_FIRST_FILE");
    const file2 = makeDiagramFile(directory, "second.mmd", "B_SECOND_FILE");
    await allowServerToUsePath(file1);
    await allowServerToUsePath(file2);
    await executeExpression(`showOpenedFile(${JSON.stringify(file1)}, ${JSON.stringify(readFileSync(file1, "utf8"))})`);
    await waitMilliseconds(800);
    // Step: file1 changes on disk; the reload starts and is held.
    await holdOpenedFileReloads();
    writeFileSync(file1, 'flowchart TD\n  B_FIRST_FILE_CHANGED["changed"]\n');
    await waitMilliseconds(800);
    assert.equal(await executeExpression("window.heldReloads.length"), 1);
    // Step: file2 starts to open, and in the same step the held reload arrives.
    await executeExpression(`(() => {
        showOpenedFile(${JSON.stringify(file2)}, ${JSON.stringify(readFileSync(file2, "utf8"))});
        window.heldReloads.shift()(new Response('flowchart TD\\n  B_FIRST_FILE_CHANGED["changed"]\\n'));
    })()`);
    await waitMilliseconds(1000);
    // Step: file2 stays and no question shows.
    assert.match(await executeExpression("codeBox.value"), /B_SECOND_FILE/);
    assert.doesNotMatch(await executeExpression("codeBox.value"), /B_FIRST_FILE_CHANGED/);
    assert.equal(await executeExpression("window.confirmCalls"), 0);
});
