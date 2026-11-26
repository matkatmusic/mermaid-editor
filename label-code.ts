// A fence is a line of three backticks. The lines between two fences are one code block, drawn left-justified with every space kept.
// The pattern also eats the line break before the opening fence and after the closing fence: the block is a block, so it breaks the line itself.
// It has one capture group, the code text, so label.split(pattern) gives text, code, text, code, ...
const LABEL_LINE_BREAK = String.raw`(?:<br\s*\/?>|\\n)`;
export const FENCED_CODE_BLOCK_PATTERN = new RegExp('(?:^|' + LABEL_LINE_BREAK + ')```' + LABEL_LINE_BREAK + '([\\s\\S]*?)' + LABEL_LINE_BREAK + '```(?:' + LABEL_LINE_BREAK + '|$)', 'gi');
export const CODE_LINE_BREAK_PATTERN = new RegExp(LABEL_LINE_BREAK, 'i');
export const CODE_BLOCK_STYLE = 'display:block;text-align:left;white-space:pre';

// Mermaid sizes each node before the page can change its text, so the code tag goes into the source that Mermaid gets.
// Only the render path uses this text; the file and the source editor keep the backticks.
export function buildSourceWithCodeTags(source: string) {
  // The first alternative takes a whole comment line, so the JSON of a props line stays as it is.
  return source.replace(/^[ \t]*%%.*$|"[^"\n]*"/gm, (quoted) => {
    if (!quoted.startsWith('"'))
      return quoted;
    const withBackticks = quoted.slice(1, -1).replace(/#96;/g, '`');
    const withCodeBlocks = withBackticks.replace(FENCED_CODE_BLOCK_PATTERN, (_block, codeText: string) => {
      const codeLines = codeText.split(CODE_LINE_BREAK_PATTERN).map((codeLine: string) => codeLine.replace(/&/g, '#amp;').replace(/</g, '#lt;').replace(/>/g, '#gt;').replace(/`/g, '#96;'));
      return `<code style='${CODE_BLOCK_STYLE}'>${codeLines.join('<br/>')}</code>`;
    });
    const withCodeTags = withCodeBlocks.replace(/`([^`]+)`/g, (_span, codeText: string) => '<code>' + codeText.replace(/&/g, '#amp;').replace(/</g, '#lt;').replace(/>/g, '#gt;') + '</code>');
    return '"' + withCodeTags.replace(/`/g, '#96;') + '"';
  });
}

// Retired by task 76: this ran after Mermaid had sized the node, so the wider fixed-width text overflowed the box.
export function applyCodeSpans(diagram: Element) {
  for (const label of diagram.querySelectorAll('.nodeLabel')) {
    const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    for (let current = walker.nextNode(); current; current = walker.nextNode())
      textNodes.push(current as Text);
    for (const textNode of textNodes) {
      const parts = textNode.data.split(/`([^`]+)`/);
      const hasCodeSpan = parts.length > 1;
      if (!hasCodeSpan)
        continue;
      const pieces: (string | HTMLElement)[] = [];
      for (let i = 0; i < parts.length; i++) {
        const isCodeText = i % 2 === 1;
        if (isCodeText) {
          const code = document.createElement('code');
          code.textContent = parts[i];
          pieces.push(code);
        }
        else if (parts[i] !== '')
          pieces.push(parts[i]);
      }
      textNode.replaceWith(...pieces);
    }
  }
}
