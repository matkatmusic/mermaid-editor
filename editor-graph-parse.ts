import type { EditorEdge, EditorGraph, EditorNode, EditorNodeKind } from './editor-types.ts';
import { getDeclarationRequirement, parseEditorEdgeLine, parseEditorToken, validateDeclaration } from './editor-parse.ts';

type DeclarationLine ={ shape: 'brace' | 'rect' | 'other'; label: string; lineIndex: number };

function storeDeclaration(declLines: Map<string, DeclarationLine>, token: ReturnType<typeof parseEditorToken>, lineIndex: number) {
  const isDeclaration = !!token.shape;
  const isNew = !declLines.has(token.id);
  const shouldStore = isDeclaration && isNew;
  if (shouldStore)
    declLines.set(token.id, { shape: token.shape!, label: token.label, lineIndex });
}

export function parseEditorGraph(source: string): { graph: EditorGraph; problems: string[] } {
  const lines = source.split('\n');
  const declLines = new Map<string, DeclarationLine>();
  const edges: EditorEdge[] = [];
  const references = new Map<string, number>();
  const problems: string[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    const isSkippable = !line || line.startsWith('flowchart') || line.startsWith('classDef') || line.startsWith('class ') || line.startsWith('%%');
    if (isSkippable)
      continue;
    const parsedEdges = parseEditorEdgeLine(line);
    if (parsedEdges) {
      for (const edge of parsedEdges) {
        const from = parseEditorToken(edge.fromToken);
        const to = parseEditorToken(edge.toToken);
        for (const token of [from, to]) {
          references.set(token.id, lineIndex);
          if (token.shape) {
            problems.push(`Line ${lineIndex + 1}: id "${token.id}" is declared inline on an edge; node declarations must be on their own standalone lines.`);
            validateDeclaration(token.id, token.shape, lineIndex + 1, problems);
          }
        }
        edges.push({ from: from.id, to: to.id, label: edge.label, lineIndex });
      }
    }
    else {
      const decl = parseEditorToken(line);
      if (decl.shape) {
        storeDeclaration(declLines, decl, lineIndex);
        validateDeclaration(decl.id, decl.shape, lineIndex + 1, problems);
      }
    }
  }
  for (const [id, lineIndex] of references) {
    const isUndeclared = !declLines.has(id);
    if (isUndeclared)
      problems.push(`Line ${lineIndex + 1}: id "${id}" must be declared on its own standalone line and ${getDeclarationRequirement(id)}.`);
  }
  const uniqueProblems = [...new Set(problems)];
  const nodes = new Map<string, EditorNode>();
  for (const [id, decl] of declLines) {
    const kind: EditorNodeKind = id.startsWith('Q_CHOICE')
      ? 'choice'
      : id.startsWith('Q_')
        ? 'question'
        : 'block';
    nodes.set(id, { id, kind, label: decl.label, lineIndex: decl.lineIndex });
  }
  return { graph: { lines, nodes, edges }, problems: uniqueProblems };
}
