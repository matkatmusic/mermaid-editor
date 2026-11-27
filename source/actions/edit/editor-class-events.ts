import { classEditorCancelBtn, classEditorCreateBtn, classEditorDialog, classEditorError, classEditorFill, classEditorName, classEditorStroke, classPickerBtn, classPickerList, classesDialog, codeBox } from '../../../dom.ts';
import { setEditorActionPromise } from '../../model/editor-metadata.ts';
import { createClass, setNodeClass } from './class-defs.ts';
import { findClassDef } from '../../model/class-lines.ts';
import { renderClassesDialog } from '../../views/classes-window/editor-classes-render.ts';

// Class picker (node inspector "Class" row)
function placeClassPickerListInsideWindow() {
  classPickerList.style.maxHeight = 'none';
  const listHeight = classPickerList.scrollHeight + 2;
  const buttonRect = classPickerBtn.getBoundingClientRect();
  const spaceAbove = buttonRect.top - 8;
  const spaceBelow = window.innerHeight - buttonRect.bottom - 8;
  let opensUpward = spaceAbove >= spaceBelow;
  if (listHeight <= spaceAbove)
    opensUpward = true;
  classPickerList.style.top = opensUpward ? 'auto' : '100%';
  classPickerList.style.bottom = opensUpward ? '100%' : 'auto';
  classPickerList.style.maxHeight = `${Math.max(opensUpward ? spaceAbove : spaceBelow, 0)}px`;
}
function toggleClassPickerList() {
  classPickerList.hidden = !classPickerList.hidden;
  if (!classPickerList.hidden)
    placeClassPickerListInsideWindow();
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
    try {
      await createClass(name, classEditorFill.value, classEditorStroke.value);
      if (assignToNodeId)
        await setNodeClass(assignToNodeId, name);
    }
    finally {
      // A save failure (a new document has no file) still leaves the new class in the source, so the popup must show it.
      if (classesDialog.open)
        renderClassesDialog();
    }
  })());
  classEditorDialog.close();
}

classEditorCancelBtn.addEventListener('click', closeClassEditor);
classEditorCreateBtn.addEventListener('click', createClassFromEditor);
