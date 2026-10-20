import { codeBox } from './dom.ts';
import { applyEditorSource } from './editor-actions.ts';
import { buildSourceWithAssignedClass, buildSourceWithClassColors, buildSourceWithCreatedClass, buildSourceWithDeletedClass, buildSourceWithRenamedClass } from './class-source.ts';

export async function setNodeClass(nodeId: string, className: string | null) {
  await applyEditorSource(buildSourceWithAssignedClass(codeBox.value, nodeId, className));
}

export async function createClass(name: string, fill: string, stroke: string) {
  await applyEditorSource(buildSourceWithCreatedClass(codeBox.value, name, fill, stroke));
}

export async function setClassColors(name: string, fill: string, stroke: string) {
  await applyEditorSource(buildSourceWithClassColors(codeBox.value, name, fill, stroke));
}

export async function renameClass(oldName: string, newName: string) {
  await applyEditorSource(buildSourceWithRenamedClass(codeBox.value, oldName, newName));
}

export async function removeClass(name: string) {
  await applyEditorSource(buildSourceWithDeletedClass(codeBox.value, name));
}
