export const classEditorDialogMarkup = `<dialog id="classEditorDialog">
  <h3>New class</h3>
  <label class="inspector-text-row"><span>Name:</span><input id="classEditorName" type="text"></label>
  <div class="inspector-text-row"><span>Fill:</span><input id="classEditorFill" type="color" value="#ffffff"></div>
  <div class="inspector-text-row"><span>Stroke:</span><input id="classEditorStroke" type="color" value="#000000"></div>
  <div id="classEditorError" class="dialog-error"></div>
  <menu>
    <button id="classEditorCancelBtn" type="button">Cancel</button>
    <button id="classEditorCreateBtn" type="button">Create</button>
  </menu>
</dialog>`;

export function insertClassEditorDialog(parent: Element) {
    parent.insertAdjacentHTML("beforeend", classEditorDialogMarkup);
}
