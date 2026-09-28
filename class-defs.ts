// Node color comes only from classDef/class lines now; parses and rewrites them, replacing retired state.typeColors/nodeTypes.
import { codeBox } from './dom.ts';
import { commitEditorSource } from './editor-actions.ts';

export interface ClassDef {
  name: string;
  fill: string;
  stroke: string;
  lineIndex: number;
}

const CLASSDEF_LINE_RE = /^(\s*)classDef\s+(\S+)\s+(.+?)\s*$/;
const CLASS_LINE_RE = /^(\s*)class\s+(\S+)\s+(\S+)\s*$/;

function isCommented(line: string) {
  return line.trim().startsWith('%%');
}

function parseStyleProps(styleText: string) {
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

function styleText(order: string[], props: Record<string, string>) {
  return order.map(key => `${key}:${props[key]}`).join(',');
}

export function parseClassDefs(source: string): ClassDef[] {
  const defs: ClassDef[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (isCommented(lines[i]))
      continue;
    const match = lines[i].match(CLASSDEF_LINE_RE);
    if (!match)
      continue;
    const { props } = parseStyleProps(match[3]);
    defs.push({ name: match[2], fill: props.fill ?? '', stroke: props.stroke ?? '', lineIndex: i });
  }
  return defs;
}

export function classDefByName(source: string, name: string) {
  for (const def of parseClassDefs(source)) {
    const isNamedClass = def.name === name;
    if (isNamedClass)
      return def;
  }
  return undefined;
}

// A node's class is the last `class` line (in source order) that lists its id.
export function classOfNode(source: string, nodeId: string): string | null {
  let found: string | null = null;
  for (const line of source.split('\n')) {
    if (isCommented(line))
      continue;
    const match = line.match(CLASS_LINE_RE);
    if (!match)
      continue;
    if (match[2].split(',').includes(nodeId))
      found = match[3];
  }
  return found;
}

// null when the node has no class, or its class's classDef was deleted (commented out).
export function classStyleOfNode(source: string, nodeId: string): { name: string; fill: string; stroke: string } | null {
  const name = classOfNode(source, nodeId);
  if (!name)
    return null;
  const def = classDefByName(source, name);
  if (!def)
    return null;
  return { name, fill: def.fill, stroke: def.stroke };
}

export interface ClassStyleIndex {
  assignments: Map<string, string>;
  defsByName: Map<string, ClassDef>;
}

// Parses the source once per render instead of once per node.
export function buildClassStyleIndex(source: string): ClassStyleIndex {
  const assignments = new Map<string, string>();
  for (const line of source.split('\n')) {
    if (isCommented(line))
      continue;
    const match = line.match(CLASS_LINE_RE);
    if (!match)
      continue;
    for (const id of match[2].split(','))
      assignments.set(id, match[3]);
  }
  const defsByName = new Map(parseClassDefs(source).map(def => [def.name, def]));
  return { assignments, defsByName };
}

export function styleOfNode(index: ClassStyleIndex, nodeId: string): { name: string; fill: string; stroke: string } | null {
  const name = index.assignments.get(nodeId);
  if (!name)
    return null;
  const def = index.defsByName.get(name);
  if (!def)
    return null;
  return { name, fill: def.fill, stroke: def.stroke };
}

function withClassLineRemoved(lines: string[], nodeId: string) {
  return lines.map((line) => {
    if (isCommented(line))
      return line;
    const match = line.match(CLASS_LINE_RE);
    if (!match)
      return line;
    const ids = match[2].split(',');
    const withoutId = ids.filter(id => id !== nodeId);
    if (withoutId.length === ids.length)
      return line;
    if (withoutId.length === 0)
      return `%% ${line.trim()}`;
    return `${match[1]}class ${withoutId.join(',')} ${match[3]}`;
  });
}

export function withAssignedClass(source: string, nodeId: string, className: string | null) {
  const lines = withClassLineRemoved(source.split('\n'), nodeId);
  if (className === null)
    return lines.join('\n');
  let assigned = false;
  let lastClassLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isCommented(lines[i]))
      continue;
    const match = lines[i].match(CLASS_LINE_RE);
    if (!match)
      continue;
    lastClassLineIndex = i;
    if (match[3] === className) {
      lines[i] = `${match[1]}class ${match[2]},${nodeId} ${className}`;
      assigned = true;
    }
  }
  if (!assigned) {
    const newLine = `class ${nodeId} ${className}`;
    if (lastClassLineIndex === -1)
      lines.push(newLine);
    else
      lines.splice(lastClassLineIndex + 1, 0, newLine);
  }
  return lines.join('\n');
}

export function withCreatedClass(source: string, name: string, fill: string, stroke: string) {
  const lines = source.split('\n');
  const newLine = `classDef ${name} fill:${fill},stroke:${stroke}`;
  let lastClassDefLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isCommented(lines[i]))
      continue;
    if (lines[i].match(CLASSDEF_LINE_RE))
      lastClassDefLineIndex = i;
  }
  if (lastClassDefLineIndex === -1)
    lines.push(newLine);
  else
    lines.splice(lastClassDefLineIndex + 1, 0, newLine);
  return lines.join('\n');
}

export function withClassColors(source: string, name: string, fill: string, stroke: string) {
  return source.split('\n').map((line) => {
    if (isCommented(line))
      return line;
    const match = line.match(CLASSDEF_LINE_RE);
    if (!match || match[2] !== name)
      return line;
    const { order, props } = parseStyleProps(match[3]);
    if (!order.includes('fill'))
      order.push('fill');
    if (!order.includes('stroke'))
      order.push('stroke');
    props.fill = fill;
    props.stroke = stroke;
    return `${match[1]}classDef ${name} ${styleText(order, props)}`;
  }).join('\n');
}

export function withRenamedClass(source: string, oldName: string, newName: string) {
  return source.split('\n').map((line) => {
    if (isCommented(line))
      return line;
    const classDefMatch = line.match(CLASSDEF_LINE_RE);
    if (classDefMatch && classDefMatch[2] === oldName)
      return `${classDefMatch[1]}classDef ${newName} ${classDefMatch[3]}`;
    const classMatch = line.match(CLASS_LINE_RE);
    if (classMatch && classMatch[3] === oldName)
      return `${classMatch[1]}class ${classMatch[2]} ${newName}`;
    return line;
  }).join('\n');
}

export function withDeletedClass(source: string, name: string) {
  return source.split('\n').map((line) => {
    if (isCommented(line))
      return line;
    const match = line.match(CLASSDEF_LINE_RE);
    if (!match || match[2] !== name)
      return line;
    return `%% ${line.trim()}`;
  }).join('\n');
}

export async function assignClass(nodeId: string, className: string | null) {
  await commitEditorSource(withAssignedClass(codeBox.value, nodeId, className));
}

export async function createClass(name: string, fill: string, stroke: string) {
  await commitEditorSource(withCreatedClass(codeBox.value, name, fill, stroke));
}

export async function setClassColors(name: string, fill: string, stroke: string) {
  await commitEditorSource(withClassColors(codeBox.value, name, fill, stroke));
}

export async function renameClass(oldName: string, newName: string) {
  await commitEditorSource(withRenamedClass(codeBox.value, oldName, newName));
}

export async function deleteClass(name: string) {
  await commitEditorSource(withDeletedClass(codeBox.value, name));
}
