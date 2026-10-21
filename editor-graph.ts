import { EditorValidationError } from './editor-types.ts';
import type { EditorGraph } from './editor-types.ts';
// import type { EditorEdge, EditorNode, EditorNodeKind } from './editor-types.ts';
import { codeBox } from './dom.ts';
import { reportEditorValidationError } from './render-helpers.ts';
import { parseEditorGraph } from './editor-graph-parse.ts';
// import { getDeclarationRequirement, parseEditorEdgeLine, parseEditorToken, validateDeclaration } from './editor-parse.ts';

// Retired old-name aliases: every caller now imports from editor-parse.ts, editor-metadata.ts and getEditorGraph.
// export { getDeclarationSuffix as declarationSuffixOf } from './editor-parse.ts';
// export { setEditorActionPromise } from './editor-metadata.ts';

// Moved to editor-graph-parse.ts so the command-line checker can run without the DOM.
// type DeclarationLine ={ shape: 'brace' | 'rect' | 'other'; label: string; lineIndex: number };
//
// function storeDeclaration(declLines: Map<string, DeclarationLine>, token: ReturnType<typeof parseEditorToken>, lineIndex: number) {
//   const isDeclaration = !!token.shape;
//   const isNew = !declLines.has(token.id);
//   const shouldStore = isDeclaration && isNew;
//   if (shouldStore)
//     declLines.set(token.id, { shape: token.shape!, label: token.label, lineIndex });
// }

export function getEditorGraph(): EditorGraph {
  const { graph, problems } = parseEditorGraph(codeBox.value);
  if (problems.length) {
    const error = new EditorValidationError(problems);
    reportEditorValidationError(error);
    throw error;
  }
  return graph;
  // const lines = codeBox.value.split('\n');
  // const declLines = new Map<string, DeclarationLine>();
  // const edges: EditorEdge[] = [];
  // const references = new Map<string, number>();
  // const problems: string[] = [];
  // for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
  //   const line = lines[lineIndex].trim();
  //   const isSkippable = !line || line.startsWith('flowchart') || line.startsWith('classDef') || line.startsWith('class ') || line.startsWith('%%');
  //   if (isSkippable)
  //     continue;
  //   const parsedEdges = parseEditorEdgeLine(line);
  //   if (parsedEdges) {
  //     for (const edge of parsedEdges) {
  //       const from = parseEditorToken(edge.fromToken);
  //       const to = parseEditorToken(edge.toToken);
  //       for (const token of [from, to]) {
  //         references.set(token.id, lineIndex);
  //         if (token.shape) {
  //           problems.push(`Line ${lineIndex + 1}: id "${token.id}" is declared inline on an edge; node declarations must be on their own standalone lines.`);
  //           validateDeclaration(token.id, token.shape, lineIndex + 1, problems);
  //         }
  //       }
  //       edges.push({ from: from.id, to: to.id, label: edge.label, lineIndex });
  //     }
  //   }
  //   else {
  //     const decl = parseEditorToken(line);
  //     if (decl.shape) {
  //       storeDeclaration(declLines, decl, lineIndex);
  //       validateDeclaration(decl.id, decl.shape, lineIndex + 1, problems);
  //     }
  //   }
  // }
  // for (const [id, lineIndex] of references) {
  //   const isUndeclared = !declLines.has(id);
  //   if (isUndeclared)
  //     problems.push(`Line ${lineIndex + 1}: id "${id}" must be declared on its own standalone line and ${getDeclarationRequirement(id)}.`);
  // }
  // const uniqueProblems = [...new Set(problems)];
  // if (uniqueProblems.length) {
  //   const error = new EditorValidationError(uniqueProblems);
  //   reportEditorValidationError(error);
  //   throw error;
  // }
  // const nodes = new Map<string, EditorNode>();
  // for (const [id, decl] of declLines) {
  //   const kind: EditorNodeKind = id.startsWith('Q_CHOICE')
  //     ? 'choice'
  //     : id.startsWith('Q_')
  //       ? 'question'
  //       : 'block';
  //   nodes.set(id, { id, kind, label: decl.label, lineIndex: decl.lineIndex });
  // }
  // return { lines, nodes, edges };
}

// export { getEditorGraph as editorGraph };
