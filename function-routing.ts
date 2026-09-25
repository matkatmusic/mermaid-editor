import type { EditorNode } from './editor-types.ts';

type Edge = [string, string];

interface RoutingGraph {
  header: string;
  nodes: Map<string, EditorNode>;
  edges: Edge[];
}

const SIGNATURE = /^[A-Za-z_$][A-Za-z0-9_$]*\(.*\)/;

export function isFunctionLabel(label: string): boolean {
  return SIGNATURE.test(label.trim());
}

function isFunctionNode(node: EditorNode): boolean {
  return node.id.startsWith('B_') && isFunctionLabel(node.label);
}

function leadingId(segment: string): string {
  const match = segment.trim().match(/^([A-Za-z0-9_]+)/);
  return match ? match[1] : segment.trim();
}

function parseDeclaration(line: string, lineIndex: number): EditorNode | null {
  const match = line.match(/^([A-Za-z0-9_]+)([\s\S]*)$/);
  if (!match)
    return null;
  const id = match[1];
  const rest = match[2].trim();
  const isBrace = rest.startsWith('{') && rest.endsWith('}');
  const isRect = rest.startsWith('[') && rest.endsWith(']');
  if (!isBrace && !isRect)
    return null;
  const label = rest.slice(1, -1).replace(/^"(.*)"$/, '$1');
  const kind = id.startsWith('Q_CHOICE') ? 'choice' : id.startsWith('Q_') ? 'question' : 'block';
  return { id, kind, label, lineIndex };
}

export function parseRoutingGraph(source: string): RoutingGraph {
  const nodes = new Map<string, EditorNode>();
  const edges: Edge[] = [];
  let header = 'flowchart TD';
  const lines = source.split('\n');
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    if (!line)
      continue;
    if (line.startsWith('flowchart')) {
      header = line;
      continue;
    }
    const isMeta = line.startsWith('classDef') || line.startsWith('class ') || line.startsWith('%%');
    if (isMeta)
      continue;
    if (line.includes('-->')) {
      const segments = line.split('-->');
      for (let i = 0; i + 1 < segments.length; i++)
        edges.push([leadingId(segments[i]), leadingId(segments[i + 1])]);
      continue;
    }
    const decl = parseDeclaration(line, lineIndex);
    if (decl && !nodes.has(decl.id))
      nodes.set(decl.id, decl);
  }
  return { header, nodes, edges };
}

function calleesOf(callerId: string, functionIds: Set<string>, edges: Edge[]): string[] {
  const found: string[] = [];
  const visited = new Set<string>();
  const stack = [callerId];
  while (stack.length) {
    const node = stack.pop()!;
    for (const [from, to] of edges) {
      if (from !== node)
        continue;
      if (functionIds.has(to)) {
        if (!found.includes(to))
          found.push(to);
        continue;
      }
      if (!visited.has(to)) {
        visited.add(to);
        stack.push(to);
      }
    }
  }
  return found;
}

export function filterToFunctions(source: string): string {
  const graph = parseRoutingGraph(source);
  const functionNodes = [...graph.nodes.values()]
    .filter(isFunctionNode)
    .sort((a, b) => a.lineIndex - b.lineIndex);
  const functionIds = new Set(functionNodes.map(node => node.id));
  const lines: string[] = [graph.header];
  for (const node of functionNodes)
    lines.push(`  ${node.id}["${node.label}"]`);
  for (const caller of functionNodes) {
    const callees = calleesOf(caller.id, functionIds, graph.edges)
      .map(id => graph.nodes.get(id)!)
      .sort((a, b) => a.lineIndex - b.lineIndex);
    for (const callee of callees)
      lines.push(`  ${caller.id} --> ${callee.id}`);
  }
  return lines.join('\n');
}
