import type { EditorNode } from './editor-types.ts';

export function trimEditorQuotes(text: string) {
  return text.replace(/^"(.*)"$/, '$1');
}

export function parseEditorToken(token: string) {
  const match = token.match(/^([A-Za-z0-9_]+)([\s\S]*)$/);
  if (!match)
    return { id: token, shape: null as null | 'brace' | 'rect' | 'other', label: '' };
  const id = match[1];
  const rest = match[2].trim();
  const startsBrace = rest.startsWith('{');
  const endsBrace = rest.endsWith('}');
  const isBrace = startsBrace && endsBrace;
  if (isBrace)
    return { id, shape: 'brace' as const, label: trimEditorQuotes(rest.slice(1, -1)) };
  const startsRound = rest.startsWith('([');
  const endsRound = rest.endsWith('])');
  const isRound = startsRound && endsRound;
  if (isRound)
    return { id, shape: 'other' as const, label: trimEditorQuotes(rest.slice(2, -2)) };
  const startsBracket = rest.startsWith('[');
  const endsBracket = rest.endsWith(']');
  const isBracket = startsBracket && endsBracket;
  if (isBracket)
    return { id, shape: 'rect' as const, label: trimEditorQuotes(rest.slice(1, -1)) };
  return { id, shape: null as null | 'brace' | 'rect' | 'other', label: '' };
}

export function getDeclarationRequirement(id: string) {
  const isChoice = id.startsWith('Q_CHOICE');
  if (isChoice)
    return 'start with "Q_CHOICE" and use bracket shape []';
  const isQuestion = id.startsWith('Q_');
  if (isQuestion)
    return 'start with "Q_" and use brace shape {}';
  const isBlock = id.startsWith('B_');
  if (isBlock)
    return 'start with "B_" and use bracket shape []';
  return 'use "Q_" with brace shape {} for a decision, "Q_CHOICE" with bracket shape [] for a choice, or "B_" with bracket shape [] for a static block';
}

export function validateDeclaration(id: string, shape: 'brace' | 'rect' | 'other', lineNumber: number, problems: string[]) {
  const subject = `Line ${lineNumber}: id "${id}"`;
  if (shape === 'other') {
    problems.push(`${subject} uses unsupported rounded/stadium shape; it must ${getDeclarationRequirement(id)}.`);
    return;
  }
  const isChoice = id.startsWith('Q_CHOICE');
  if (isChoice) {
    if (shape !== 'rect')
      problems.push(`${subject} is a choice and must use bracket shape [] (for example, ${id}["Choice"]).`);
    return;
  }
  const isQuestion = id.startsWith('Q_');
  if (isQuestion) {
    if (shape !== 'brace')
      problems.push(`${subject} is a decision and must use brace shape {} (for example, ${id}{"Decision"}).`);
    return;
  }
  const isBlock = id.startsWith('B_');
  if (isBlock) {
    if (shape !== 'rect')
      problems.push(`${subject} is a static block and must use bracket shape [] (for example, ${id}["Block"]).`);
    return;
  }
  problems.push(`${subject} has a non-compliant prefix; it must ${getDeclarationRequirement(id)}.`);
}

export function parseEditorEdgeLine(line: string) {
  // Mermaid allows several edge segments per line (`A --> B --> C`); split them to match its render.
  const separator = /\s--\s(?:"([^"]*)"|(.+?))\s-->\s|\s-->/g;
  const tokens: string[] = [];
  const labels: (string | undefined)[] = [];
  let tokenStart = 0;
  for (let match; (match = separator.exec(line));) {
    tokens.push(line.slice(tokenStart, match.index).trim());
    labels.push(match[1] ?? match[2]?.trim());
    tokenStart = match.index + match[0].length;
  }
  if (tokens.length === 0)
    return null;
  tokens.push(line.slice(tokenStart).trim());
  let hasEmptyToken = false;
  for (const token of tokens) {
    const isEmpty = !token;
    if (isEmpty) {
      hasEmptyToken = true;
      break;
    }
  }
  if (hasEmptyToken)
    return null;
  const segments: { fromToken: string; label: string | undefined; toToken: string }[] = [];
  for (let index = 0; index < tokens.length - 1; index++)
    segments.push({ fromToken: tokens[index], label: labels[index], toToken: tokens[index + 1] });
  return segments;
}

export function getDeclarationSuffix(node: EditorNode) {
  if (node.kind === 'question')
    return `{"${node.label}"}`;
  if (node.kind === 'choice')
    return `["${node.label}"]`;
  return `["${node.label}"]`;
}
