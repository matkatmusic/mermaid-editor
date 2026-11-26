import { codeBox } from './dom.ts';
import { appendEditorAction, applyEditorSource } from './editor-actions.ts';
import { buildSourceWithNodeSize, buildSourceWithoutNodeSize } from './node-size.ts';
import { getNodeProps } from './node-props.ts';
export function setNodeSize(id: string, width: number, height: number) {
    async function applyNodeSize() {
        await applyEditorSource(buildSourceWithNodeSize(codeBox.value, id, width, height));
    }
    appendEditorAction(applyNodeSize);
}
// Takes the size line away, so the block is drawn at its automatic size. A block without a size line adds no history step.
export function resetNodeSize(id: string) {
    async function applyAutomaticSize() {
        // const hasSizeLine = codeBox.value.split('\n').some((line) => parseSizeLine(line)?.id === id);
        const hasSize = getNodeProps(codeBox.value.split('\n'), id).width !== undefined;
        if (!hasSize)
            return;
        await applyEditorSource(buildSourceWithoutNodeSize(codeBox.value, id));
    }
    appendEditorAction(applyAutomaticSize);
}
