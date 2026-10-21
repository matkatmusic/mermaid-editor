import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

test('test_file_menu_replaces_the_four_toolbar_buttons', async () => {
  // Scenario: four file actions live in one dropdown menu; entries keep old ids and handlers.
  await executeExpression("loadDiagram('accountability.mmd')");
  await waitMilliseconds(300);

  // Step: the four actions are no longer bare toolbar buttons and now live inside #fileMenu.
  const placement = await executeExpression(`JSON.stringify({
    bareInHeader: ['newBtn','saveBtn','openFileBtn','resetBtn'].map(id => !!document.querySelector('#header > #' + id)),
    inMenu: ['newBtn','saveBtn','openFileBtn','resetBtn'].map(id => !!document.querySelector('#fileMenu #' + id)),
  })`).then(JSON.parse);
  assert.deepEqual(placement.bareInHeader, [false, false, false, false]);
  assert.deepEqual(placement.inMenu, [true, true, true, true]);

  // Step: Reset entry clears a chosen phone path and closes the menu.
  await executeExpression("document.querySelector('#phoneDiagram [data-choose=\"Q_CHOICE_THEM_DONE_SPEAKING_Y\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
  await waitMilliseconds(100);
  assert.equal(await executeExpression("phonePath.length"), 1);
  await executeExpression("document.getElementById('fileMenu').open = true");
  await executeExpression("document.getElementById('resetBtn').click()");
  await waitMilliseconds(100);
  assert.equal(await executeExpression("phonePath.length"), 0);
  assert.equal(await executeExpression("document.getElementById('fileMenu').open"), false);

  // Step: Save entry PUTs the diagram to the server and closes the menu.
  const saved = await executeExpression(`(async () => {
    let posted = null;
    const originalFetch = window.fetch;
    window.fetch = (url, opts) => { if (opts && opts.method === 'PUT') posted = String(url); return originalFetch(url, opts); };
    document.getElementById('fileMenu').open = true;
    document.getElementById('saveBtn').click();
    await new Promise(r => setTimeout(r, 200));
    window.fetch = originalFetch;
    return JSON.stringify({ posted, open: document.getElementById('fileMenu').open });
  })()`).then(JSON.parse);
  assert.ok(saved.posted && saved.posted.includes('/api/diagrams/'));
  assert.equal(saved.open, false);

  // Step: Open file entry shows the OS open dialog and closes the menu.
  const opened = await executeExpression(`(() => {
    let clicked = false;
    const originalFetch = window.fetch;
    window.fetch = (url, opts) => { if (url === '/api/open-file') { clicked = true; return new Promise(() => {}); } return originalFetch(url, opts); };
    document.getElementById('fileMenu').open = true;
    document.getElementById('openFileBtn').click();
    window.fetch = originalFetch;
    return JSON.stringify({ clicked, open: document.getElementById('fileMenu').open });
  })()`).then(JSON.parse);
  assert.equal(opened.clicked, true);
  assert.equal(opened.open, false);

  // Step: New entry resets the editor source and closes the menu.
  await executeExpression("document.getElementById('fileMenu').open = true");
  await executeExpression("document.getElementById('newBtn').click()");
  await waitMilliseconds(100);
  assert.equal(await executeExpression("codeBox.value"), 'flowchart TD\n  B_NEW[New idea]');
  assert.equal(await executeExpression("document.getElementById('fileMenu').open"), false);

  // Step: restore the accountability diagram so later runs start clean.
  await executeExpression("loadDiagram('accountability.mmd')");
  await waitMilliseconds(300);
});

test('test_save_overwrites_the_opened_file_and_save_as_uses_the_os_dialog', async () => {
  // Scenario: fake OS file dialogs record every write, so no real disk file is touched.
  const result = await executeExpression(`(async () => {
    const writes = [];
    const fakeHandle = (name, text) => ({
      name,
      getFile: async () => new File([text], name),
      createWritable: async () => ({ write: async (data) => writes.push(name + ':' + data), close: async () => {} }),
    });
    const originalFetch = window.fetch;
    const originalSave = window.showSaveFilePicker;
    let saveDialogs = 0;
    window.fetch = async (url, opts) => {
      if (url !== '/api/open-file')
        return originalFetch(url, opts);
      if (opts && opts.method === 'PUT') {
        writes.push('opened.mmd:' + opts.body);
        return new Response('OK');
      }
      return Response.json({ path: '/tmp/opened.mmd', text: 'flowchart TD\\n  B_OPENED[Opened]' });
    };
    window.showSaveFilePicker = async () => { saveDialogs++; return fakeHandle('picked.mmd', ''); };
    document.getElementById('openFileBtn').click();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('saveBtn').click();
    await new Promise(r => setTimeout(r, 200));
    const afterOpenSave = { writes: writes.slice(), saveDialogs };
    document.getElementById('newBtn').click();
    await new Promise(r => setTimeout(r, 200));
    document.getElementById('saveBtn').click();
    await new Promise(r => setTimeout(r, 200));
    document.getElementById('saveBtn').click();
    await new Promise(r => setTimeout(r, 200));
    window.fetch = originalFetch;
    window.showSaveFilePicker = originalSave;
    return JSON.stringify({ afterOpenSave, writes, saveDialogs });
  })()`).then(JSON.parse);
  // Step: Save after Open File overwrites the opened file without any dialog.
  assert.deepEqual(result.afterOpenSave, { writes: ['opened.mmd:flowchart TD\n  B_OPENED[Opened]'], saveDialogs: 0 });
  // Step: Save on a new diagram shows the Save-As dialog once; the second Save reuses the picked file.
  assert.equal(result.saveDialogs, 1);
  assert.deepEqual(result.writes.slice(1), ['picked.mmd:flowchart TD\n  B_NEW[New idea]', 'picked.mmd:flowchart TD\n  B_NEW[New idea]']);
  await executeExpression("loadDiagram('accountability.mmd')");
  await waitMilliseconds(300);
});

test('test_canceling_the_open_dialog_logs_a_message_and_leaves_the_diagram_unchanged', async () => {
  // Scenario: the user dismisses the OS open dialog; the server answers 204.
  const result = await executeExpression(`(async () => {
    const originalFetch = window.fetch;
    const originalLog = console.log;
    const messages = [];
    const before = document.getElementById('code').value;
    window.fetch = async (url, opts) => url === '/api/open-file' ? new Response(null, { status: 204 }) : originalFetch(url, opts);
    console.log = (...args) => { messages.push(args.join(' ')); };
    document.getElementById('openFileBtn').click();
    await new Promise(r => setTimeout(r, 200));
    window.fetch = originalFetch;
    console.log = originalLog;
    return JSON.stringify({ messages, unchanged: document.getElementById('code').value === before });
  })()`).then(JSON.parse);
  // Step: the cancel is logged once and nothing else changes.
  assert.ok(result.messages.includes('User canceled Open File'));
  assert.equal(result.unchanged, true);
});

test('test_open_file_menu_list_stacks_above_the_selected_item_widget', async () => {
  await executeExpression("document.getElementById('fileMenu').open = true");
  const zIndexes = await executeExpression("({ menu: Number(getComputedStyle(document.getElementById('fileMenuItems')).zIndex), widget: Number(getComputedStyle(document.getElementById('nodeInspector')).zIndex) })");
  assert.ok(zIndexes.menu > zIndexes.widget);
});
