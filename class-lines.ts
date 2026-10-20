// Node color comes only from classDef/class lines now; parses them, replacing retired state.typeColors/nodeTypes.

export interface ClassDef {
  name: string;
  fill: string;
  stroke: string;
  lineIndex: number;
}

export const CLASSDEF_LINE_RE = /^(\s*)classDef\s+(\S+)\s+(.+?)\s*$/;
export const CLASS_LINE_RE = /^(\s*)class\s+(\S+)\s+(\S+)\s*$/;

export function isCommented(line: string) {
  return line.trim().startsWith('%%');
}

export function parseStyleProps(styleText: string) {
  const order: string[] = [];
  const props: Record<string, string> = {};
  for (const part of styleText.split(',')) {
    const trimmed = part.trim();
    if (!trimmed)
      continue;
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1)
      continue;
    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();
    if (!(key in props))
      order.push(key);
    props[key] = value;
  }
  return { order, props };
}

export function buildStyleText(order: string[], props: Record<string, string>) {
  const parts: string[] = [];
  for (const key of order)
    parts.push(`${key}:${props[key]}`);
  return parts.join(',');
}

export function parseClassDefs(source: string): ClassDef[] {
  const defs: ClassDef[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const isLineCommented = isCommented(lines[i]);
    if (isLineCommented)
      continue;
    const match = lines[i].match(CLASSDEF_LINE_RE);
    if (!match)
      continue;
    const { props } = parseStyleProps(match[3]);
    defs.push({ name: match[2], fill: props.fill ?? '', stroke: props.stroke ?? '', lineIndex: i });
  }
  return defs;
}

export function findClassDef(source: string, name: string) {
  for (const def of parseClassDefs(source)) {
    const isNamedClass = def.name === name;
    if (isNamedClass)
      return def;
  }
  return undefined;
}

// A node's class is the last `class` line (in source order) that lists its id.
export function findClassOfNode(source: string, nodeId: string): string | null {
  let found: string | null = null;
  for (const line of source.split('\n')) {
    const isLineCommented = isCommented(line);
    if (isLineCommented)
      continue;
    const match = line.match(CLASS_LINE_RE);
    if (!match)
      continue;
    const ids = match[2].split(',');
    const listsNode = ids.includes(nodeId);
    if (listsNode)
      found = match[3];
  }
  return found;
}

// null when the node has no class, or its class's classDef was deleted (commented out).
export function findClassStyleOfNode(source: string, nodeId: string): { name: string; fill: string; stroke: string } | null {
  const name = findClassOfNode(source, nodeId);
  if (!name)
    return null;
  const def = findClassDef(source, name);
  if (!def)
    return null;
  return { name, fill: def.fill, stroke: def.stroke };
}
