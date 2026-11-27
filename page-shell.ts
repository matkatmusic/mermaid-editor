import { insertHeaderBar } from "./source/views/header-bar/header-bar-markup.ts";
import { insertEditorDrawer } from "./source/views/editor-drawer/editor-drawer-markup.ts";
import { insertNodeActionsBar } from "./node-actions-bar-markup.ts";
import { insertMainDiagram } from "./source/views/main-diagram/main-diagram-markup.ts";
import { insertInspector, insertInspectorRetiredTemplate } from "./source/views/inspector/inspector-markup.ts";
import { insertPhone } from "./source/views/phone/phone-markup.ts";
import { insertInspectorNotice } from "./source/views/inspector/inspector-notice-markup.ts";
import { insertViewportMenu } from "./source/views/main-diagram/viewport-menu-markup.ts";
import { insertClassEditorDialog } from "./class-editor-dialog-markup.ts";
import { insertClassesWindow } from "./classes-window-markup.ts";
import { insertWalkBackDialog } from "./source/views/inspector/walk-back-dialog-markup.ts";

const sharedStyle = `  :root { --bg: #fff; --bg-light: #f5f5f5; --bg-card: #fafafa; --text: #000; --text-quiet: #666; --line: #ccc; --line-soft: #ddd; --border-strong: #333; --border-input: #555; --border-mid: #888; --error: red; --select-stroke: #1565c0; --preview-stroke: #ef6c00; --mask: rgba(0,0,0,0.55); }
  body.dark { color-scheme: dark; --bg: #1e1e1e; --bg-light: #2b2b2b; --bg-card: #2b2b2b; --text: #e6e6e6; --text-quiet: #a0a0a0; --line: #555; --line-soft: #555; --border-strong: #999; --border-input: #999; --border-mid: #999; --error: #ff6b6b; --select-stroke: #64b5f6; --preview-stroke: #ffb74d; --mask: rgba(255,255,255,0.55); }
  body { margin: 0; display: flex; flex-direction: column; height: 100vh; font-family: sans-serif; background: var(--bg); color: var(--text); }
  #main { flex: 1; display: flex; min-height: 0; }
  #workspace { flex: 1 1 auto; min-width: 0; display: flex; min-height: 0; }
  .error-line-link { background: none; border: 0; padding: 0; font: inherit; color: inherit; text-decoration: underline; cursor: pointer; }
  /* The hidden Mermaid measuring box needs the same code style, or Mermaid sizes the node too small. */
  #diagram code, #phoneDiagram code, body > div[id^="ddiagram-"] code { font-family: monospace; padding: 0 4px; border-radius: 3px; background: rgba(0,0,0,0.12); }
  #centerColumn { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
  .inspector-text-row { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
  .inspector-text-row input { flex: 1; min-width: 0; padding: 6px 8px; border: 2px solid var(--border-input); border-radius: 4px; font: inherit; }
  input[type="color"], .inspector-text-row input[type="color"] { flex: none; width: 32px; height: 32px; padding: 0; border: 2px solid var(--border-input); border-radius: 4px; background: none; cursor: pointer; }
  input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
  input[type="color"]::-webkit-color-swatch { border: none; border-radius: 2px; }
  dialog { color: var(--text); background: var(--bg); border: 1px solid var(--line-soft); border-radius: 12px; padding: 16px; }
  dialog::backdrop { background: rgba(0,0,0,0.5); }
  dialog menu { display: flex; justify-content: flex-end; gap: 8px; padding: 0; margin: 12px 0 0; }
  .dialog-error { color: var(--error); min-height: 1.2em; font-size: 13px; }`;

const style = document.createElement("style");
style.textContent = sharedStyle;
document.head.append(style);

insertHeaderBar(document.body);
document.body.insertAdjacentHTML("beforeend", '<div id="main"><div id="workspace"></div></div>');
const main = document.querySelector("#main")!;
const workspace = document.querySelector("#workspace")!;
insertEditorDrawer(workspace);
insertNodeActionsBar(workspace);
workspace.insertAdjacentHTML("beforeend", '<div id="centerColumn"></div>');
const centerColumn = document.querySelector("#centerColumn")!;
insertMainDiagram(centerColumn);
insertInspector(centerColumn);
insertPhone(main);
insertInspectorRetiredTemplate(document.body);
insertInspectorNotice(document.body);
insertViewportMenu(document.body);
insertClassEditorDialog(document.body);
insertClassesWindow(document.body);
insertWalkBackDialog(document.body);
