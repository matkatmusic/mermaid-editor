import { EDITOR_METADATA_FENCE, EDITOR_METADATA_WARNING } from './editor-types.ts';
import type { EditorMetadata } from './editor-types.ts';
import { state } from './state.ts';
import { outputBox } from './dom.ts';

export function splitEditorMetadata(source: string) {
  const headerPattern = /(?:^|\r?\n)%%%%====\r?\n%% DO NOT MODIFY - AUTOMATICALLY GENERATED DURING EVERY SAVE\r?\n%% (\{[^\r\n]*\})\r?\n%%%%====/g;
  const matches = [...source.matchAll(headerPattern)];
  if (matches.length === 0)
    return { source, metadata: null as EditorMetadata | null };
  let metadata: EditorMetadata | null = null;
  try {
    const parsed = JSON.parse(matches[matches.length - 1][1]);
    const isObject = typeof parsed === 'object';
    const hasParsed = !!parsed;
    const isRecord = hasParsed && isObject;
    if (isRecord) {
      const lastSelectedNodeId = typeof parsed.lastSelectedNodeId === 'string' || parsed.lastSelectedNodeId === null
        ? parsed.lastSelectedNodeId
        : null;
      metadata = {
        lastSelectedNodeId,
        outputScrollLeft: typeof parsed.outputScrollLeft === 'number' ? parsed.outputScrollLeft : undefined,
        outputScrollTop: typeof parsed.outputScrollTop === 'number' ? parsed.outputScrollTop : undefined,
        mainZoomPercent: typeof parsed.mainZoomPercent === 'number' ? parsed.mainZoomPercent : undefined,
        typeColors: getStringRecord(parsed.typeColors),
        nodeTypes: getStringRecord(parsed.nodeTypes),
      };
    }
  }
  catch {
    // A malformed generated trailer is discarded and replaced on the next save.
  }
  return { source: source.replace(headerPattern, '').replace(/\s+$/, ''), metadata };
}

export function buildSourceWithMetadata(source: string) {
  const body = splitEditorMetadata(source).source;
  const metadata: EditorMetadata = {
    lastSelectedNodeId: state.selectedEditorNodeId,
    outputScrollLeft: outputBox.scrollLeft,
    outputScrollTop: outputBox.scrollTop,
    mainZoomPercent: state.mainZoomPercent,
    // Retired: typeColors/nodeTypes metadata is no longer written; color lives in classDef/class lines.
    // typeColors: state.typeColors,
    // nodeTypes: state.nodeTypes,
  };
  return `${body}\n${EDITOR_METADATA_FENCE}\n%% ${EDITOR_METADATA_WARNING}\n%% ${JSON.stringify(metadata)}\n${EDITOR_METADATA_FENCE}`;
}

export function getStringRecord(value: unknown) {
  const isMissing = !value;
  const isNotObject = typeof value !== 'object';
  const isMissingOrNotObject = isMissing || isNotObject;
  const isArray = Array.isArray(value);
  const isInvalid = isMissingOrNotObject || isArray;
  if (isInvalid)
    return undefined;
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string')
      result[key] = entry;
  }
  return result;
}

export function applyTypeMetadata(metadata: EditorMetadata | null) {
  // No-op: colors now come from classDef/class lines, not saved metadata.
}

export function setEditorActionPromise(promise: Promise<void>) {
  state.editorActionPromise = promise;
  (window as any).editorActionPromise = promise;
}

setEditorActionPromise(Promise.resolve());
