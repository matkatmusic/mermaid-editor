import { setStatus } from './diagram-io.ts';
import { state } from './state.ts';

// <base>-path-<N>.mmd, where N is one more than the highest N already in the folder (0 when none).
export function findNextPathFileName(baseName: string, existingNames: string[]): string {
  const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedBaseName}-path-(\\d+)\\.mmd$`);
  let nextNumber = 0;
  for (const name of existingNames) {
    const match = name.match(pattern);
    if (!match)
      continue;
    const usedNumber = Number(match[1]);
    if (usedNumber >= nextNumber)
      nextNumber = usedNumber + 1;
  }
  return `${baseName}-path-${nextNumber}.mmd`;
}

export async function writeToServerDiagrams(diagramName: string, source: string) {
  const listResponse = await fetch('/api/diagrams');
  const existingNames: string[] = await listResponse.json();
  const fileName = findNextPathFileName(diagramName.replace(/\.mmd$/, ''), existingNames);
  const response = await fetch('/api/diagrams/' + encodeURIComponent(fileName), { method: 'PUT', body: source });
  if (!response.ok)
    throw new Error(`Writing ${fileName} failed: ${response.status} ${await response.text()}`);
  setStatus('Wrote ' + fileName);
}

// Chrome hides the opened file's folder, so ask for it once per opened file. False when canceled.
export async function selectPathFolder(): Promise<boolean> {
  if (state.pathFolderHandle)
    return true;
  try {
    state.pathFolderHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  }
  catch (error) {
    const isUserCancel = (error as DOMException).name === 'AbortError';
    if (!isUserCancel)
      throw error;
    return false;
  }
  return true;
}

export async function writeToOpenedFileFolder(openedFileName: string, source: string) {
  const hasFolder = await selectPathFolder();
  if (!hasFolder) {
    console.log('User canceled Write chosen path');
    return;
  }
  const folder = state.pathFolderHandle!;
  const existingNames: string[] = [];
  for await (const name of (folder as any).keys())
    existingNames.push(name);
  const fileName = findNextPathFileName(openedFileName.replace(/\.mmd$/, ''), existingNames);
  const fileHandle = await folder.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(source);
  await writable.close();
  setStatus('Wrote ' + fileName);
}
