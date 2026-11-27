export const viewportMenuStyle = `  #viewportMenu { position: fixed; z-index: 30; display: flex; flex-direction: column; gap: 4px; padding: 6px; background: var(--bg); border: 1px solid var(--border-mid); border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); }
  #viewportMenu[hidden] { display: none; }`;

export const viewportMenuMarkup = `<div id="viewportMenu" role="menu" hidden>
  <button id="addDecisionBlockMenuBtn" type="button" role="menuitem">Add Decision Block</button>
  <button id="addStaticBlockMenuBtn" type="button" role="menuitem">Add Static Block</button>
</div>`;

export function insertViewportMenu(parent: Element) {
    const style = document.createElement("style");
    style.textContent = viewportMenuStyle;
    document.head.append(style);
    parent.insertAdjacentHTML("beforeend", viewportMenuMarkup);
}
