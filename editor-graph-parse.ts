import { parsePropsLine } from './node-props.ts';
import type { NodeProps } from './node-props.ts';
import type { EditorEdge, EditorGraph, EditorNode, EditorNodeKind } from './editor-types.ts';
import { getDeclarationRequirement, parseEditorEdgeLine, parseEditorToken, validateDeclaration } from './editor-parse.ts';

type DeclarationLine ={ shape: 'brace' | 'hexagon' | 'rect' | 'other'; label: string; lineIndex: number };

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
  const multiLineIds = new Set<string>();
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
      else {
        const opensQuotedLabel = line.match(/^([A-Za-z0-9_]+)(?:\[|\{\{?|\(\[)"/);
        if (opensQuotedLabel) {
          multiLineIds.add(opensQuotedLabel[1]);
          problems.push(`Line ${lineIndex + 1}: the definition of "${opensQuotedLabel[1]}" must start and end on one line. Its text has a line break.`);
        }
      }
    }
  }
  for (const [id, lineIndex] of references) {
    const isUndeclared = !declLines.has(id);
    if (isUndeclared && multiLineIds.has(id))
      continue;
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
  // const sizes = new Map<string, { width: number; height: number }>();
  // for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
  //   const line = lines[lineIndex].trim();
  //   if (!line.startsWith(SIZE_PREFIX))
  //     continue;
  //   const size = parseSizeLine(line);
  //   if (!size) {
  //     problems.push(`Line ${lineIndex + 1}: the size line must look like "${buildSizeLine('B_NAME', 352, 154)}": the node id, then the width and the height in whole px.`);
  //     continue;
  //   }
  //   if (!declLines.has(size.id)) {
  //     problems.push(`Line ${lineIndex + 1}: the size line names "${size.id}", which is not declared.`);
  //     continue;
  //   }
  //   if (sizes.has(size.id)) {
  //     problems.push(`Line ${lineIndex + 1}: "${size.id}" has two size lines; keep one.`);
  //     continue;
  //   }
  //   sizes.set(size.id, { width: size.width, height: size.height });
  // }
  // const noteLinesById = new Map<string, string[]>();
  // for (const line of lines) {
  //   const note = parseNoteLine(line);
  //   if (!note)
  //     continue;
  //   const noteLines = noteLinesById.get(note.id) ?? [];
  //   noteLines.push(note.text);
  //   noteLinesById.set(note.id, noteLines);
  // }
  const propsById = new Map<string, NodeProps>();
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const props = parsePropsLine(lines[lineIndex]);
    if (!props)
      continue;
    if (!declLines.has(props.blockId)) {
      problems.push(`Line ${lineIndex + 1}: the props line names "${props.blockId}", which is not declared.`);
      continue;
    }
    if (propsById.has(props.blockId)) {
      problems.push(`Line ${lineIndex + 1}: "${props.blockId}" has two props lines; keep one.`);
      continue;
    }
    propsById.set(props.blockId, props);
  }
  const uniqueProblems = [...new Set(problems)];
  const nodes = new Map<string, EditorNode>();
  for (const [id, decl] of declLines) {
    const kind: EditorNodeKind = id.startsWith('Q_CHOICE')
      ? 'choice'
      : id.startsWith('Q_')
        ? 'question'
        : 'block';
    // const noteLines: string[] = [];
    // for (let i = decl.lineIndex - 1; i >= 0 && lines[i].trim().startsWith(NOTE_PREFIX); i--)
    //   noteLines.unshift(lines[i].trim().slice(NOTE_PREFIX.length).trim());
    // const noteLines = noteLinesById.get(id) ?? [];
    const props = propsById.get(id);
    let size: EditorNode['size'];
    if (props?.width !== undefined) {
      if (props.height !== undefined)
        size = { width: props.width, height: props.height };
    }
    nodes.set(id, { id, kind, label: decl.label, note: props?.note ?? '', lineIndex: decl.lineIndex, isHexagon: decl.shape === 'hexagon', size });
  }
  return { graph: { lines, nodes, edges }, problems: uniqueProblems };
}
