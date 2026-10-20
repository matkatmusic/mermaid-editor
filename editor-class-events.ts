import { classEditorCancelBtn, classEditorCreateBtn, classEditorDialog, classEditorError, classEditorFill, classEditorName, classEditorStroke, classPickerBtn, classPickerList, classesDialog, codeBox } from './dom.ts';
import { setEditorActionPromise } from './editor-metadata.ts';
import { createClass, setNodeClass } from './class-defs.ts';
import { findClassDef } from './class-lines.ts';
import { renderClassesDialog } from './editor-classes-render.ts';

// Class picker (node inspector "Class" row)
function toggleClassPickerList() {
  classPickerList.hidden = !classPickerList.hidden;
}
function clearClassPickerOnOutsideClick(event: MouseEvent) {
  const insidePicker = (event.target as HTMLElement).closest('#classPicker');
  if (!insidePicker)
    classPickerList.hidden = true;
}
function selectClassPickerRow(event: MouseEvent) {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button.class-picker-row');
  if (!button)
    return;
  const nodeId = classPickerBtn.dataset.nodeId!;
  classPickerList.hidden = true;
  if (button.dataset.className)
    setEditorActionPromise(setNodeClass(nodeId, button.dataset.className));
  else if (button.dataset.classNone !== undefined)
    setEditorActionPromise(setNodeClass(nodeId, null));
  else if (button.dataset.classNew !== undefined)
    openClassEditor(nodeId);
}
classPickerBtn.addEventListener('click', toggleClassPickerList);
document.addEventListener('click', clearClassPickerOnOutsideClick);
classPickerList.addEventListener('click', selectClassPickerRow);

// Class editor dialog (create a new class, optionally assigning it to a node)
let classEditorAssignNodeId: string | null = null;

export function openClassEditor(assignToNodeId: string | null) {
  classEditorAssignNodeId = assignToNodeId;
  classEditorName.value = '';
  classEditorFill.value = '#ffffff';
  classEditorStroke.value = '#000000';
  classEditorError.textContent = '';
  classEditorDialog.showModal();
}

function closeClassEditor() {
  classEditorDialog.close();
}

function createClassFromEditor() {
  const name = classEditorName.value.trim();
  if (!name) {
    classEditorError.textContent = 'Name is required.';
    return;
  }
  const existingClassDef = findClassDef(codeBox.value, name);
  if (existingClassDef) {
    classEditorError.textContent = `Class "${name}" already exists.`;
    return;
  }
  classEditorError.textContent = '';
  const assignToNodeId = classEditorAssignNodeId;
  setEditorActionPromise((async () => {
    await createClass(name, classEditorFill.value, classEditorStroke.value);
    if (assignToNodeId)
      await setNodeClass(assignToNodeId, name);
    if (classesDialog.open)
      renderClassesDialog();
  })());
  classEditorDialog.close();
}

classEditorCancelBtn.addEventListener('click', closeClassEditor);
classEditorCreateBtn.addEventListener('click', createClassFromEditor);
