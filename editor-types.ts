export type EditorNodeKind = 'question' | 'block' | 'choice';

export const INSPECTOR_TITLES: Record<EditorNodeKind, string> = { question: 'Decision block', block: 'static block', choice: 'choice block' };

export interface EditorNode {
  id: string;
  kind: EditorNodeKind;
  label: string;
  note: string;
  lineIndex: number;
  // A decision written Q_X{{"text"}} shows as a hexagon; Q_X{"text"} shows as a diamond. False for every other kind.
  isHexagon: boolean;
  // Node box size in px at 100% zoom, from the node's `%% ==size==:` line; undefined when the node has none.
  size?: { width: number; height: number };
}

export const NOTE_PREFIX = '%% ==note==:';
export const SIZE_PREFIX = '%% ==size==:';

export interface EditorEdge {
  from: string;
  to: string;
  label?: string;
  lineIndex: number;
}

export interface EditorGraph {
  lines: string[];
  nodes: Map<string, EditorNode>;
  edges: EditorEdge[];
}

export class EditorValidationError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Invalid diagram:\n${problems.join('\n')}`);
    this.problems = problems;
    this.name = 'EditorValidationError';
  }
}

export interface PendingRemoval {
  questionId: string;
  choices: string[];
  index: number;
}

export interface EditorMetadata {
  lastSelectedNodeId: string | null;
  outputScrollLeft?: number;
  outputScrollTop?: number;
  mainZoomPercent?: number;
  typeColors?: Record<string, string>;
  nodeTypes?: Record<string, string>;
}

export const EDITOR_METADATA_FENCE = '%%%%====';
export const EDITOR_METADATA_WARNING = 'DO NOT MODIFY - AUTOMATICALLY GENERATED DURING EVERY SAVE';

