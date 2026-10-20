import type { ClassDef } from './class-lines.ts';
import { CLASS_LINE_RE, isCommented, parseClassDefs } from './class-lines.ts';

export interface ClassStyleIndex {
  assignments: Map<string, string>;
  defsByName: Map<string, ClassDef>;
}

// Parses the source once per render instead of once per node.
export function buildClassStyleIndex(source: string): ClassStyleIndex {
  const assignments = new Map<string, string>();
  for (const line of source.split('\n')) {
    const isLineCommented = isCommented(line);
    if (isLineCommented)
      continue;
    const match = line.match(CLASS_LINE_RE);
    if (!match)
      continue;
    for (const id of match[2].split(','))
      assignments.set(id, match[3]);
  }
  const defsByName = new Map<string, ClassDef>();
  for (const def of parseClassDefs(source))
    defsByName.set(def.name, def);
  return { assignments, defsByName };
}

export function findNodeStyle(index: ClassStyleIndex, nodeId: string): { name: string; fill: string; stroke: string } | null {
  const name = index.assignments.get(nodeId);
  if (!name)
    return null;
  const def = index.defsByName.get(name);
  if (!def)
    return null;
  return { name, fill: def.fill, stroke: def.stroke };
}
