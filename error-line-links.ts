import { codeBox } from './dom.ts';
import { setDrawerOpen } from './source/views/header-bar/diagram-io.ts';
import { measureSourceLines } from './source-lines.ts';

function selectSourceLine(lineNumber: number) {
  const lines = codeBox.value.split('\n');
  let start = 0;
  for (let i = 0; i < lineNumber - 1; i++)
    start += lines[i].length + 1;
  setDrawerOpen(true);
  const { tops } = measureSourceLines();
  codeBox.scrollTop = tops[lineNumber - 1] - parseFloat(getComputedStyle(codeBox).paddingTop);
  codeBox.focus({ preventScroll: true });
  codeBox.setSelectionRange(start, start + lines[lineNumber - 1].length);
}

// Writes the message into the element, with every "Line N" as a button that selects line N in the source editor.
export function renderErrorMessageWithLineLinks(element: HTMLElement, message: string) {
  const pieces: (string | HTMLButtonElement)[] = [];
  for (const part of message.split(/(Line \d+)/)) {
    const lineMatch = part.match(/^Line (\d+)$/);
    if (!lineMatch) {
      pieces.push(part);
      continue;
    }
    const lineNumber = Number(lineMatch[1]);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'error-line-link';
    button.dataset.line = String(lineNumber);
    button.textContent = part;
    button.addEventListener('click', () => selectSourceLine(lineNumber));
    pieces.push(button);
  }
  element.replaceChildren(...pieces);
}
