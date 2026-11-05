import { NOTE_PREFIX } from './editor-types.ts';
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
  const blockExits = new Map<string, { firstEdgeLineIndex: number; nextIds: Set<string> }>();
  for (const edge of edges) {
    const isBlock = !edge.from.startsWith('Q_');
    if (!isBlock)
      continue;
    const exit = blockExits.get(edge.from) ?? { firstEdgeLineIndex: edge.lineIndex, nextIds: new Set<string>() };
    exit.nextIds.add(edge.to);
    blockExits.set(edge.from, exit);
  }
  for (const [id, exit] of blockExits) {
    const leadsToManyNodes = exit.nextIds.size >= 2;
    if (leadsToManyNodes)
      problems.push(`Line ${exit.firstEdgeLineIndex + 1}: block "${id}" leads to ${exit.nextIds.size} nodes (${[...exit.nextIds].join(', ')}); a block must lead to one node, so the phone view can follow one question at a time.`);
  }
  const uniqueProblems = [...new Set(problems)];
  const nodes = new Map<string, EditorNode>();
  for (const [id, decl] of declLines) {
    const kind: EditorNodeKind = id.startsWith('Q_CHOICE')
      ? 'choice'
      : id.startsWith('Q_')
        ? 'question'
        : 'block';
    const noteLines: string[] = [];
    for (let i = decl.lineIndex - 1; i >= 0 && lines[i].trim().startsWith(NOTE_PREFIX); i--)
      noteLines.unshift(lines[i].trim().slice(NOTE_PREFIX.length).trim());
    nodes.set(id, { id, kind, label: decl.label, note: noteLines.join('\n'), lineIndex: decl.lineIndex });
  }
  return { graph: { lines, nodes, edges }, problems: uniqueProblems };
}
