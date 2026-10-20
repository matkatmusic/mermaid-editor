import type { EditorEdge, EditorGraph } from './editor-types.ts';
import { getDeclarationSuffix } from './editor-parse.ts';

// New nodes go before the class block; mermaid drops classes stated before a node's declaration.
export function buildSourceWithLinesReplaced(graph: EditorGraph, removedLineIndexes: Set<number>, newLines: string[]) {
  const kept: string[] = [];
  for (let lineIndex = 0; lineIndex < graph.lines.length; lineIndex++) {
    const isRemoved = removedLineIndexes.has(lineIndex);
    if (!isRemoved)
      kept.push(graph.lines[lineIndex]);
  }
  let classBlockStart = -1;
  for (let i = 0; i < kept.length; i++) {
    const trimmed = kept[i].trim();
    const isClassDef = trimmed.startsWith('classDef');
    const isClassAssignment = trimmed.startsWith('class ');
    const isClassLine = isClassDef || isClassAssignment;
    if (isClassLine) {
      classBlockStart = i;
      break;
    }
  }
  if (classBlockStart === -1)
    return [...kept, ...newLines].join('\n');
  return [...kept.slice(0, classBlockStart), ...newLines, ...kept.slice(classBlockStart)].join('\n');
}

export function getNextEditorId(prefix: string, graph: EditorGraph) {
  let n = 1;
  while (graph.nodes.has(`${prefix}_${n}`))
    n++;
  return `${prefix}_${n}`;
}

export function buildChoiceId(questionId: string, suffix: string) {
  return `Q_CHOICE_${questionId.replace(/^Q_/, '')}_${suffix}`;
}

export function findOutgoingDestination(id: string, graph: EditorGraph) {
  for (const edge of graph.edges) {
    const isOutgoing = edge.from === id;
    if (isOutgoing)
      return edge.to;
  }
  return undefined;
}

export function buildSourceWithOutgoingChanged(id: string, destination: string | undefined, graph: EditorGraph) {
  const removedLineIndexes = new Set<number>();
  const restoredIds = new Set<string>();
  const newLines: string[] = [];
  for (const edge of graph.edges) {
    if (edge.from !== id)
      continue;
    removedLineIndexes.add(edge.lineIndex);
    for (const endpointId of [edge.from, edge.to]) {
      const endpoint = graph.nodes.get(endpointId);
      const isOnEdgeLine = endpoint?.lineIndex === edge.lineIndex;
      const isNotRestored = !restoredIds.has(endpointId);
      const shouldRestore = isOnEdgeLine && isNotRestored;
      if (shouldRestore) {
        restoredIds.add(endpointId);
        newLines.push(`  ${endpointId}${getDeclarationSuffix(endpoint!)}`);
      }
    }
  }
  if (destination)
    newLines.push(`  ${id} --> ${destination}`);
  return buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines);
}

export function replaceOutgoing(id: string, destination: string, graph: EditorGraph) {
  return buildSourceWithOutgoingChanged(id, destination, graph);
}

export function removeOutgoing(id: string, graph: EditorGraph) {
  return buildSourceWithOutgoingChanged(id, undefined, graph);
}

export function appendInlineDecl(edge: EditorEdge, keepEndpointId: string, graph: EditorGraph, newLines: string[]) {
  const node = graph.nodes.get(keepEndpointId);
  const isOnEdgeLine = node?.lineIndex === edge.lineIndex;
  if (isOnEdgeLine)
    newLines.push(`  ${keepEndpointId}${getDeclarationSuffix(node!)}`);
}
