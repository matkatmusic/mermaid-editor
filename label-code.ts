// Text in single backticks shows as a code span in the rendered diagram; the backticks stay in the file.
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
