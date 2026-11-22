// Mermaid sizes each node before the page can change its text, so the code tag goes into the source that Mermaid gets.
// Only the render path uses this text; the file and the source editor keep the backticks.
export function buildSourceWithCodeTags(source: string) {
  return source.replace(/"[^"\n]*"/g, (quoted) => quoted.replace(/`([^`]+)`/g, (_span, codeText: string) => '<code>' + codeText.replace(/&/g, '#amp;').replace(/</g, '#lt;').replace(/>/g, '#gt;') + '</code>'));
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
