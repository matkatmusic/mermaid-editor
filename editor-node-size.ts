import { codeBox } from './dom.ts';
import { appendEditorAction, applyEditorSource } from './editor-actions.ts';
import { buildSourceWithNodeSize } from './node-size.ts';

export function setNodeSize(id: string, width: number, height: number) {
    async function applyNodeSize() {
        await applyEditorSource(buildSourceWithNodeSize(codeBox.value, id, width, height));
    }
    appendEditorAction(applyNodeSize);
}
