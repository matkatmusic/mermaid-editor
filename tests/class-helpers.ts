import { executeExpression } from "./cdp.ts";

export async function openClassPickerNew() {
  await executeExpression("document.getElementById('classPickerBtn').click()");
  await executeExpression("document.querySelector('#classPickerList [data-class-new]').click()");
}

export async function fillClassEditor(name: string, fill: string, stroke: string) {
  await executeExpression(`(() => {
    document.getElementById('classEditorName').value = ${JSON.stringify(name)};
    document.getElementById('classEditorFill').value = ${JSON.stringify(fill)};
    document.getElementById('classEditorStroke').value = ${JSON.stringify(stroke)};
  })()`);
}
