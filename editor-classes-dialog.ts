import { classesCloseBtn, classesDialog, classesError, classesList, classesMenuBtn, classesNewBtn, codeBox } from './dom.ts';
import { setEditorActionPromise } from './editor-metadata.ts';
import { removeClass, renameClass, setClassColors } from './class-defs.ts';
import { parseClassDefs } from './class-lines.ts';
import { openClassEditor } from './editor-class-events.ts';
import { renderClassesDialog } from './editor-classes-render.ts';

function openClassesDialog() {
  document.getElementById('fileMenu')!.removeAttribute('open');
  renderClassesDialog();
  classesDialog.showModal();
}

function closeClassesDialog() {
  classesDialog.close();
}

function openNewClassEditor() {
  openClassEditor(null);
}

function updateClassFromRow(event: Event) {
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
}

function removeClassFromRow(event: MouseEvent) {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.classes-delete');
  if (!button)
    return;
  const name = button.closest<HTMLElement>('.classes-row')!.dataset.className!;
  setEditorActionPromise(removeClass(name).then(renderClassesDialog));
}

classesMenuBtn.addEventListener('click', openClassesDialog);
classesCloseBtn.addEventListener('click', closeClassesDialog);
classesNewBtn.addEventListener('click', openNewClassEditor);
classesList.addEventListener('change', updateClassFromRow);
classesList.addEventListener('click', removeClassFromRow);
