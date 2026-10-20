import type { EditorNode } from './editor-types.ts';
import { classPickerBtn, classPickerLabel, classPickerList, classPickerSwatch, codeBox } from './dom.ts';
import { findClassDef, findClassOfNode, parseClassDefs } from './class-lines.ts';

export function renderClassPicker(node: EditorNode) {
  const source = codeBox.value;
  const className = findClassOfNode(source, node.id);
  const def = className ? findClassDef(source, className) : undefined;
  classPickerBtn.dataset.nodeId = node.id;
  classPickerLabel.textContent = className ?? '(none)';
  classPickerSwatch.style.background = def ? def.fill : 'transparent';
  classPickerSwatch.style.borderColor = def ? def.stroke : '#999';
  const rows: string[] = [];
  for (const classDef of parseClassDefs(source))
    rows.push(`<button type="button" class="class-picker-row" data-class-name="${classDef.name}"><span class="class-swatch" style="background:${classDef.fill};border-color:${classDef.stroke}"></span>${classDef.name}</button>`);
  rows.push('<button type="button" class="class-picker-row" data-class-none>(none)</button>');
  rows.push('<button type="button" class="class-picker-row" data-class-new>new...</button>');
  classPickerList.innerHTML = rows.join('');
  classPickerList.hidden = true;
}
