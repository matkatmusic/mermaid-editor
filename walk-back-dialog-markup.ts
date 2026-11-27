export const walkBackDialogStyle = `  #walkBackChoices { display: flex; flex-direction: column; gap: 8px; }
  #walkBackChoices .phone-choice { flex: none; }`;

export const walkBackDialogMarkup = `<dialog id="walkBackDialog">
  <h3>Walk back to</h3>
  <div id="walkBackChoices"></div>
  <menu>
    <button id="walkBackCancelBtn" type="button">Cancel</button>
  </menu>
</dialog>`;

export function insertWalkBackDialog(parent: Element) {
    const style = document.createElement("style");
    style.textContent = walkBackDialogStyle;
    document.head.append(style);
    parent.insertAdjacentHTML("beforeend", walkBackDialogMarkup);
}
