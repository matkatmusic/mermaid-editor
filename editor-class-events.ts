import { classEditorCancelBtn, classEditorCreateBtn, classEditorDialog, classEditorError, classEditorFill, classEditorName, classEditorStroke, classPickerBtn, classPickerList, classesCloseBtn, classesDialog, classesError, classesList, classesMenuBtn, classesNewBtn, codeBox } from './dom.ts';
import { setEditorActionPromise } from './editor-graph.ts';
import { assignClass, classDefByName, createClass, deleteClass, parseClassDefs, renameClass, setClassColors } from './class-defs.ts';

// Class picker (node inspector "Class" row)
classPickerBtn.addEventListener('click', () => {
  classPickerList.hidden = !classPickerList.hidden;
});
document.addEventListener('click', (event) => {
  const insidePicker = (event.target as HTMLElement).closest('#classPicker');
  if (!insidePicker)
    classPickerList.hidden = true;
});
classPickerList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button.class-picker-row');
  if (!button)
    return;
  const nodeId = classPickerBtn.dataset.nodeId!;
  classPickerList.hidden = true;
  if (button.dataset.className)
    setEditorActionPromise(assignClass(nodeId, button.dataset.className));
  else if (button.dataset.classNone !== undefined)
    setEditorActionPromise(assignClass(nodeId, null));
  else if (button.dataset.classNew !== undefined)
    openClassEditor(nodeId);
});

// Class editor dialog (create a new class, optionally assigning it to a node)
let classEditorAssignNodeId: string | null = null;

function openClassEditor(assignToNodeId: string | null) {
  classEditorAssignNodeId = assignToNodeId;
  classEditorName.value = '';
  classEditorFill.value = '#ffffff';
  classEditorStroke.value = '#000000';
  classEditorError.textContent = '';
  classEditorDialog.showModal();
}

classEditorCancelBtn.addEventListener('click', () => classEditorDialog.close());
classEditorCreateBtn.addEventListener('click', () => {
  const name = classEditorName.value.trim();
  if (!name) {
    classEditorError.textContent = 'Name is required.';
    return;
  }
  const existingClassDef = classDefByName(codeBox.value, name);
  if (existingClassDef) {
    classEditorError.textContent = `Class "${name}" already exists.`;
    return;
  }
  classEditorError.textContent = '';
  const assignToNodeId = classEditorAssignNodeId;
  setEditorActionPromise((async () => {
    await createClass(name, classEditorFill.value, classEditorStroke.value);
    if (assignToNodeId)
      await assignClass(assignToNodeId, name);
    if (classesDialog.open)
      renderClassesDialog();
  })());
  classEditorDialog.close();
});

// File menu > Classes... dialog (list every class; edit, rename, or delete it)
function renderClassesDialog() {
  const defs = parseClassDefs(codeBox.value);
  const rowHtmlParts: string[] = [];
  for (const def of defs) {
    rowHtmlParts.push(`
    <div class="classes-row" data-class-name="${def.name}">
      <input type="color" class="classes-fill" value="${def.fill}">
      <input type="color" class="classes-stroke" value="${def.stroke}">
      <input type="text" class="classes-name" value="${def.name}">
      <button type="button" class="classes-delete">Delete</button>
    </div>`);
  }
  classesList.innerHTML = rowHtmlParts.join('');
  classesError.textContent = '';
}

classesMenuBtn.addEventListener('click', () => {
  document.getElementById('fileMenu')!.removeAttribute('open');
  renderClassesDialog();
  classesDialog.showModal();
});
classesCloseBtn.addEventListener('click', () => classesDialog.close());
classesNewBtn.addEventListener('click', () => openClassEditor(null));
classesList.addEventListener('change', (event) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>('.classes-row');
  if (!row)
    return;
  const name = row.dataset.className!;
  const target = event.target as HTMLInputElement;
  const isFillInput = target.classList.contains('classes-fill');
  const isStrokeInput = target.classList.contains('classes-stroke');
  const isNameInput = target.classList.contains('classes-name');
  const isColorInput = isFillInput ? true : isStrokeInput;
  if (isColorInput) {
    const fill = row.querySelector<HTMLInputElement>('.classes-fill')!.value;
    const stroke = row.querySelector<HTMLInputElement>('.classes-stroke')!.value;
    setEditorActionPromise(setClassColors(name, fill, stroke).then(renderClassesDialog));
  }
  else if (isNameInput) {
    const newName = target.value.trim();
    const isNameBlank = !newName;
    const isNameUnchanged = newName === name;
    const isNameUnusable = isNameBlank ? true : isNameUnchanged;
    if (isNameUnusable) {
      target.value = name;
      return;
    }
    let isNameTaken = false;
    for (const def of parseClassDefs(codeBox.value)) {
      const isSameName = def.name === newName;
      if (isSameName)
        isNameTaken = true;
    }
    if (isNameTaken) {
      classesError.textContent = `Class "${newName}" already exists.`;
      target.value = name;
      return;
    }
    setEditorActionPromise(renameClass(name, newName).then(renderClassesDialog));
  }
});
classesList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.classes-delete');
  if (!button)
    return;
  const name = button.closest<HTMLElement>('.classes-row')!.dataset.className!;
  setEditorActionPromise(deleteClass(name).then(renderClassesDialog));
});
