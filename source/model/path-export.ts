import { codeBox } from '../app/dom.ts';
import { parseEdges } from './diagram-source.ts';
import { getEditorGraph } from './editor-graph.ts';
// import { decodeLabelQuotes, getDeclarationSuffix } from './editor-parse.ts';
import { decodeLabelQuotes } from './editor-parse.ts';
import { buildHistoryRows } from './phone-render.ts';
import { state } from '../app/state.ts';
import { writeToOpenedFileFolder, writeToServerDiagrams } from '../actions/file/path-write.ts';
// import { buildClassStyleIndex } from './class-style-index.ts';
// import { buildClassLines } from './subset-source.ts';
// import { buildPropsLine } from './node-props.ts';
import { buildPathSource } from './subset-source.ts';
import type { EditorGraph } from './editor-types.ts';

// Node ids the phone history shows, in order; choices that were not taken are left out.
export function getChosenPathIds(): string[] {
  const rows = buildHistoryRows(parseEdges(codeBox.value), getEditorGraph());
  const ids: string[] = [];
  for (const row of rows) {
    const isAlreadyListed = ids[ids.length - 1] === row.id;
    if (!isAlreadyListed)
      ids.push(row.id);
    const isAnsweredDecision = row.status === 'past';
    if (isAnsweredDecision)
      ids.push(row.chosenChoiceId);
  }
  return ids;
}

function getPlainLabel(id: string, graph: EditorGraph) {
  return decodeLabelQuotes(graph.nodes.get(id)!.label).replace(/<br\s*\/?>/gi, ' ');
}

// One "%% question -> chosen answer" line per decision, for the top of the path file.
function buildDecisionComment(ids: string[], graph: EditorGraph): string[] {
  const lines = ['%% Decisions made:'];
  for (let i = 0; i + 1 < ids.length; i++) {
    const isDecision = graph.nodes.get(ids[i])!.kind === 'question';
    if (!isDecision)
      continue;
    lines.push(`%%   ${getPlainLabel(ids[i], graph)} -> ${getPlainLabel(ids[i + 1], graph)}`);
  }
  const hasNoDecisions = lines.length === 1;
  if (hasNoDecisions)
    lines.push('%%   none');
  return lines;
}

// Moved to subset-source.ts, which takes the source as an argument.
// // Copies each used classDef line verbatim, then one class line per class for the path's nodes.
// function buildClassLines(declaredIds: Set<string>): string[] {
//   const classIndex = buildClassStyleIndex(codeBox.value);
//   const idsByClass = new Map<string, string[]>();
//   for (const id of declaredIds) {
//     const className = classIndex.assignments.get(id);
//     if (!className)
//       continue;
//     const classIds = idsByClass.get(className) ?? [];
//     classIds.push(id);
//     idsByClass.set(className, classIds);
//   }
//   const sourceLines = codeBox.value.split('\n');
//   const lines: string[] = [];
//   for (const [className, classIds] of idsByClass) {
//     const classDef = classIndex.defsByName.get(className);
//     if (classDef)
//       lines.push(`  ${sourceLines[classDef.lineIndex].trim()}`);
//     lines.push(`  class ${classIds.join(',')} ${className}`);
//   }
//   return lines;
// }

export function buildChosenPathSource(ids: string[]): string {
  // const graph = getEditorGraph();
  // const lines = [...buildDecisionComment(ids, graph), 'flowchart TD'];
  // const declaredIds = new Set<string>();
  // for (const id of ids) {
  //   const isDeclared = declaredIds.has(id);
  //   if (isDeclared)
  //     continue;
  //   declaredIds.add(id);
  //   const size = graph.nodes.get(id)!.size;
  //   if (size)
  //     lines.push(`  ${buildPropsLine({ blockId: id, width: size.width, height: size.height })}`);
  //   lines.push(`  ${id}${getDeclarationSuffix(graph.nodes.get(id)!)}`);
  // }
  // for (let i = 0; i + 1 < ids.length; i++)
  //   lines.push(`  ${ids[i]} --> ${ids[i + 1]}`);
  // // lines.push(...buildClassLines(declaredIds));
  // lines.push(...buildClassLines(codeBox.value, declaredIds));
  // // for (const id of declaredIds) {
  // //   const size = graph.nodes.get(id)!.size;
  // //   if (size)
  // //     lines.push(buildSizeLine(id, size.width, size.height));
  // // }
  // return lines.join('\n') + '\n';
  const graph = getEditorGraph();
  return [...buildDecisionComment(ids, graph), buildPathSource(graph, ids)].join('\n');
}

export async function writeChosenPath() {
  const source = buildChosenPathSource(getChosenPathIds());
  if (state.currentName) {
    await writeToServerDiagrams(state.currentName, source);
    return;
  }
  const openedFileName = state.openedFileHandle?.name ?? state.loadedPath?.split('/').pop();
  if (!openedFileName)
    throw new Error('Save the diagram before writing a chosen path');
  await writeToOpenedFileFolder(openedFileName, source);
}
