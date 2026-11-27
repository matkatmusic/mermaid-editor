export const classesWindowStyle = `  .classes-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
  .classes-row .classes-name { flex: 1; min-width: 0; padding: 4px 6px; font: inherit; }`;

export const classesWindowMarkup = `<dialog id="classesDialog">
  <h3>Classes</h3>
  <div id="classesList"></div>
  <div id="classesError" class="dialog-error"></div>
  <menu>
    <button id="classesNewBtn" type="button">New...</button>
    <button id="classesCloseBtn" type="button">Close</button>
  </menu>
</dialog>`;

export function insertClassesWindow(parent: Element) {
    const style = document.createElement("style");
    style.textContent = classesWindowStyle;
    document.head.append(style);
    parent.insertAdjacentHTML("beforeend", classesWindowMarkup);
}
