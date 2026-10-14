import { evaluate } from "./cdp.ts";

export async function openClassPickerNew() {
  await evaluate("document.getElementById('classPickerBtn').click()");
  await evaluate("document.querySelector('#classPickerList [data-class-new]').click()");
}

export async function fillClassEditor(name: string, fill: string, stroke: string) {
  await evaluate(`(() => {
    document.getElementById('classEditorName').value = ${JSON.stringify(name)};
    document.getElementById('classEditorFill').value = ${JSON.stringify(fill)};
    document.getElementById('classEditorStroke').value = ${JSON.stringify(stroke)};
  })()`);
}
