import { codeBox } from './dom.ts';
import { appendEditorAction, applyEditorSource } from './editor-actions.ts';
import { buildSourceWithNodeAlign, getNodeAlign } from './source/model/node-align.ts';
import type { Alignment, Justification } from './source/model/node-align.ts';

// The stored value of the other row is read when the queued action runs, so a text edit queued before it cannot be overwritten.
export function setNodeJustification(id: string, justification: Justification) {
    async function applyNodeJustification() {
        const stored = getNodeAlign(codeBox.value.split('\n'), id);
        if (stored.justification === justification)
            return;
        await applyEditorSource(buildSourceWithNodeAlign(codeBox.value, id, justification, stored.alignment));
    }
    appendEditorAction(applyNodeJustification);
}

export function setNodeAlignment(id: string, alignment: Alignment) {
    async function applyNodeAlignment() {
        const stored = getNodeAlign(codeBox.value.split('\n'), id);
        if (stored.alignment === alignment)
            return;
        await applyEditorSource(buildSourceWithNodeAlign(codeBox.value, id, stored.justification, alignment));
    }
    appendEditorAction(applyNodeAlignment);
}
