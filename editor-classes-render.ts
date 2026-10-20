import { classesError, classesList, codeBox } from './dom.ts';
import { parseClassDefs } from './class-lines.ts';

// File menu > Classes... dialog (list every class; edit, rename, or delete it)
export function renderClassesDialog() {
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
