export const editorDrawerStyle = `  #drawer { display: flex; height: 100%; border-right: 1px solid var(--line); }
  #drawer.closed { border-right: none; }
  #editor { display: flex; flex-direction: column; width: 320px; height: 100%; }
  #codeRow { display: flex; flex: 1; min-height: 0; }
  #sourceGutter { flex: none; width: 44px; overflow: hidden; box-sizing: border-box; background: var(--bg-light); color: var(--text-quiet); border-right: 1px solid var(--line); font-family: monospace; font-size: 14px; user-select: none; }
  #sourceGutter div { position: relative; }
  #sourceGutter span { position: absolute; right: 6px; }
  #code { /* width: 320px; height: 100%; */ flex: 1; min-width: 0; box-sizing: border-box; padding: 12px; font-family: monospace; font-size: 14px; border: none; resize: none; background-attachment: local; background-repeat: no-repeat; }
  /* #drawer.closed #code { display: none; } */
  #drawer.closed #editor { display: none; }
  #errorLog { display: none; }
  #errorLog.open { display: block; height: 25%; overflow: auto; margin: 0; padding: 8px 12px; box-sizing: border-box; border-top: 1px solid var(--line); color: var(--error); white-space: pre-wrap; font: 12px/1.4 monospace; }
  #drawerToggle { width: 24px; border: none; border-left: 1px solid var(--line); background: var(--bg-light); cursor: pointer; }
  #drawer.closed #drawerToggle { border-left: none; }`;

export const editorDrawerMarkup = `    <div id="drawer" class="closed">
      <div id="editor">
        <div id="codeRow">
          <div id="sourceGutter" aria-hidden="true"></div>
          <textarea id="code">flowchart TD
  B_NEW[New idea]</textarea>
        </div>
        <pre id="errorLog"></pre>
      </div>
      <button id="drawerToggle" title="Show/hide editor">&#9776;</button>
    </div>`;

export function insertEditorDrawer(parent: Element) {
    const style = document.createElement("style");
    style.textContent = editorDrawerStyle;
    document.head.append(style);
    parent.insertAdjacentHTML("beforeend", editorDrawerMarkup);
}
