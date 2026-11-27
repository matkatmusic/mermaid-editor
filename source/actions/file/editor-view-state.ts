import { codeBox } from '../../../dom.ts';
import { state } from '../../../state.ts';
import { buildSourceWithMetadata } from '../../model/editor-metadata.ts';
import { saveDiagram } from './diagram-save.ts';
import { renderSourceLines } from '../../views/editor-drawer/source-lines.ts';

export async function saveEditorViewState() {
  const hasSaveTarget = !!state.currentName || !!state.openedFileHandle || !!state.loadedPath;
  if (!hasSaveTarget)
    return;
  const sourceWithMetadata = buildSourceWithMetadata(codeBox.value);
  if (sourceWithMetadata === codeBox.value)
    return;
  const { scrollTop, selectionStart, selectionEnd } = codeBox;
  codeBox.value = sourceWithMetadata;
  codeBox.scrollTop = scrollTop;
  codeBox.setSelectionRange(selectionStart, selectionEnd);
  renderSourceLines();
  await saveDiagram();
}
