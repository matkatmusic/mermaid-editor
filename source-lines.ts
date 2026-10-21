import { codeBox, sourceGutter } from './dom.ts';
import { state } from './state.ts';

export function measureSourceLines() {
  const style = getComputedStyle(codeBox);
  const mirror = document.createElement('div');
  mirror.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;width:${codeBox.clientWidth}px;padding:${style.padding};font:${style.font};line-height:${style.lineHeight};`;
  for (const line of codeBox.value.split('\n')) {
    const lineEl = document.createElement('div');
    lineEl.textContent = line || ' ';
    mirror.append(lineEl);
  }
  document.body.append(mirror);
  const tops: number[] = [];
  for (const lineEl of mirror.children)
    tops.push((lineEl as HTMLElement).offsetTop);
  const end = mirror.offsetHeight;
  mirror.remove();
  return { tops, end };
}

function renderGutter(tops: number[], end: number) {
  const content = document.createElement('div');
  content.style.height = end + 'px';
  for (let i = 0; i < tops.length; i++) {
    const numberEl = document.createElement('span');
    numberEl.textContent = String(i + 1);
    numberEl.style.top = tops[i] + 'px';
    content.append(numberEl);
  }
  sourceGutter.replaceChildren(content);
  sourceGutter.scrollTop = codeBox.scrollTop;
}

function findNodeLineIndex(lines: string[], id: string) {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const startsWithId = trimmed.startsWith(id);
    const isNodeDefinition = startsWithId && ['[', '{', '('].includes(trimmed.charAt(id.length));
    if (isNodeDefinition)
      return i;
  }
  return -1;
}

function renderSelectedLineBand(tops: number[], end: number) {
  const id = state.selectedEditorNodeId;
  const lineIndex = id ? findNodeLineIndex(codeBox.value.split('\n'), id) : -1;
  const hasSelectedLine = lineIndex !== -1;
  if (!hasSelectedLine) {
    codeBox.style.backgroundImage = 'none';
    return;
  }
  const top = tops[lineIndex];
  const isLastLine = lineIndex === tops.length - 1;
  const bottom = isLastLine ? end - parseFloat(getComputedStyle(codeBox).paddingBottom) : tops[lineIndex + 1];
  const band = 'color-mix(in srgb, var(--select-stroke) 25%, transparent)';
  codeBox.style.backgroundImage = `linear-gradient(transparent ${top}px, ${band} ${top}px, ${band} ${bottom}px, transparent ${bottom}px)`;
}

export function renderSourceLines() {
  const { tops, end } = measureSourceLines();
  renderGutter(tops, end);
  renderSelectedLineBand(tops, end);
}

function syncGutterScroll() {
  sourceGutter.scrollTop = codeBox.scrollTop;
}

codeBox.addEventListener('scroll', syncGutterScroll);
new ResizeObserver(renderSourceLines).observe(codeBox);
