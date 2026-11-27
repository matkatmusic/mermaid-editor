import { CLASSDEF_LINE_RE, CLASS_LINE_RE, buildStyleText, isCommented, parseStyleProps } from './class-lines.ts';

function buildLinesWithoutNodeClass(lines: string[], nodeId: string) {
  const result: string[] = [];
  for (const line of lines) {
    const isLineCommented = isCommented(line);
    const match = line.match(CLASS_LINE_RE);
    const hasNoMatch = !match;
    const isUnrelated = isLineCommented || hasNoMatch;
    if (isUnrelated) {
      result.push(line);
      continue;
    }
    const ids = match![2].split(',');
    const withoutId: string[] = [];
    for (const id of ids) {
      const isOtherNode = id !== nodeId;
      if (isOtherNode)
        withoutId.push(id);
    }
    const isUnchanged = withoutId.length === ids.length;
    if (isUnchanged) {
      result.push(line);
      continue;
    }
    const isEmpty = withoutId.length === 0;
    if (isEmpty)
      result.push(`%% ${line.trim()}`);
    else
      result.push(`${match![1]}class ${withoutId.join(',')} ${match![3]}`);
  }
  return result;
}

export function buildSourceWithAssignedClass(source: string, nodeId: string, className: string | null) {
  const lines = buildLinesWithoutNodeClass(source.split('\n'), nodeId);
  if (className === null)
    return lines.join('\n');
  let assigned = false;
  let lastClassLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const isLineCommented = isCommented(lines[i]);
    if (isLineCommented)
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

export function buildSourceWithCreatedClass(source: string, name: string, fill: string, stroke: string) {
  const lines = source.split('\n');
  const newLine = `classDef ${name} fill:${fill},stroke:${stroke}`;
  let lastClassDefLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const isLineCommented = isCommented(lines[i]);
    if (isLineCommented)
      continue;
    const isClassDefLine = CLASSDEF_LINE_RE.test(lines[i]);
    if (isClassDefLine)
      lastClassDefLineIndex = i;
  }
  if (lastClassDefLineIndex === -1)
    lines.push(newLine);
  else
    lines.splice(lastClassDefLineIndex + 1, 0, newLine);
  return lines.join('\n');
}

export function buildSourceWithClassColors(source: string, name: string, fill: string, stroke: string) {
  const result: string[] = [];
  for (const line of source.split('\n')) {
    const isLineCommented = isCommented(line);
    const match = line.match(CLASSDEF_LINE_RE);
    const isOtherClass = match?.[2] !== name;
    const isUnrelated = isLineCommented || isOtherClass;
    if (isUnrelated) {
      result.push(line);
      continue;
    }
    const { order, props } = parseStyleProps(match![3]);
    const hasFill = order.includes('fill');
    if (!hasFill)
      order.push('fill');
    const hasStroke = order.includes('stroke');
    if (!hasStroke)
      order.push('stroke');
    props.fill = fill;
    props.stroke = stroke;
    result.push(`${match![1]}classDef ${name} ${buildStyleText(order, props)}`);
  }
  return result.join('\n');
}

export function buildSourceWithRenamedClass(source: string, oldName: string, newName: string) {
  const result: string[] = [];
  for (const line of source.split('\n')) {
    const isLineCommented = isCommented(line);
    if (isLineCommented) {
      result.push(line);
      continue;
    }
    const classDefMatch = line.match(CLASSDEF_LINE_RE);
    const isRenamedDef = classDefMatch?.[2] === oldName;
    if (isRenamedDef) {
      result.push(`${classDefMatch![1]}classDef ${newName} ${classDefMatch![3]}`);
      continue;
    }
    const classMatch = line.match(CLASS_LINE_RE);
    const isRenamedAssignment = classMatch?.[3] === oldName;
    if (isRenamedAssignment)
      result.push(`${classMatch![1]}class ${classMatch![2]} ${newName}`);
    else
      result.push(line);
  }
  return result.join('\n');
}

export function buildSourceWithDeletedClass(source: string, name: string) {
  const result: string[] = [];
  for (const line of source.split('\n')) {
    const isLineCommented = isCommented(line);
    const match = line.match(CLASSDEF_LINE_RE);
    const isOtherClass = match?.[2] !== name;
    const isUnrelated = isLineCommented || isOtherClass;
    if (isUnrelated)
      result.push(line);
    else
      result.push(`%% ${line.trim()}`);
  }
  return result.join('\n');
}
