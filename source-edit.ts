import { NOTE_PREFIX } from './editor-types.ts';
import type { EditorEdge, EditorGraph } from './editor-types.ts';
import { getDeclarationSuffix } from './editor-parse.ts';
import { parseSizeLine } from './node-size.ts';
import { parseAlignLine } from './node-align.ts';
import { CLASS_LINE_RE } from './class-lines.ts';

// New nodes go before the class block; mermaid drops classes stated before a node's declaration.
export function buildSourceWithLinesReplaced(graph: EditorGraph, removedLineIndexes: Set<number>, newLines: string[]) {
  const removedWithNotes = new Set(removedLineIndexes);
  for (const removedIndex of removedLineIndexes) {
    for (let i = removedIndex - 1; i >= 0 && graph.lines[i].trim().startsWith(NOTE_PREFIX); i--)
      removedWithNotes.add(i);
  }
  const removedNodeIds = new Set<string>();
  for (const node of graph.nodes.values()) {
    if (removedLineIndexes.has(node.lineIndex))
      removedNodeIds.add(node.id);
  }
  // A removed definition line can hold a node that stays: an inline `A --> B["x"]` whose B is declared again in newLines or used by a kept edge.
  const deletedNodeIds = new Set<string>();
  for (const id of removedNodeIds) {
    const idPattern = new RegExp(`(?<!\\w)${id}(?!\\w)`);
    const isDeclaredAgain = newLines.some((line) => idPattern.test(line));
    const isUsedByKeptEdge = graph.edges.some((edge) => !removedWithNotes.has(edge.lineIndex) && (edge.from === id || edge.to === id));
    if (!isDeclaredAgain && !isUsedByKeptEdge)
      deletedNodeIds.add(id);
  }
  const kept: string[] = [];
  for (let lineIndex = 0; lineIndex < graph.lines.length; lineIndex++) {
    const isRemoved = removedWithNotes.has(lineIndex);
    if (isRemoved)
      continue;
    const size = parseSizeLine(graph.lines[lineIndex]);
    const isSizeOfRemovedNode = !!size && deletedNodeIds.has(size.id);
    if (isSizeOfRemovedNode)
      continue;
    const align = parseAlignLine(graph.lines[lineIndex]);
    const isAlignOfRemovedNode = !!align && deletedNodeIds.has(align.id);
    if (isAlignOfRemovedNode)
      continue;
    const classMatch = graph.lines[lineIndex].match(CLASS_LINE_RE);
    if (!classMatch) {
      kept.push(graph.lines[lineIndex]);
      continue;
    }
    const namedIds = classMatch[2].split(',');
    const remainingIds = namedIds.filter((id) => !deletedNodeIds.has(id));
    if (remainingIds.length === namedIds.length) {
      kept.push(graph.lines[lineIndex]);
      continue;
    }
    if (remainingIds.length > 0)
      kept.push(`${classMatch[1]}class ${remainingIds.join(',')} ${classMatch[3]}`);
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
  for (const edge of graph.edges) {
    const isOnRemovedLine = removedLineIndexes.has(edge.lineIndex);
    const isKept = isOnRemovedLine && edge.from !== id;
    if (isKept) {
      const arrow = edge.label ? `-- "${edge.label}" -->` : '-->';
      newLines.push(`  ${edge.from} ${arrow} ${edge.to}`);
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
