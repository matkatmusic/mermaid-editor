export const mainDiagramStyle = `  #output { flex: 1; min-width: 0; height: 100%; overflow: auto; padding: 12px; box-sizing: border-box; container-type: size; }
  /* Half a pane of empty space on every side, so a node at the diagram's edge can still scroll to the exact center. */
  /* max-content: a full-width #diagram spends its whole width on the two paddings, so a narrow diagram has no room to scroll sideways. */
  #diagram { padding: 50cqh 50cqw; width: max-content; }
  #diagram svg { max-width: none !important; }
  body > div[id^="ddiagram-"] { position: fixed; visibility: hidden; }
  #error { color: var(--error); white-space: pre-wrap; padding: 12px; }
  #diagram .dim { opacity: 0.15; }
  /* The negative margin of a label (node-size.ts) puts its text 4 px outside the label box; the label box clips it unless it is visible. */
  #diagram foreignObject { overflow: visible; }
  #diagram g.node.editor-selected rect, #diagram g.node.editor-selected path, #diagram g.node.editor-selected polygon { stroke: var(--select-stroke) !important; stroke-width: 4px !important; }
  #diagram g.node.editor-preview rect, #diagram g.node.editor-preview path, #diagram g.node.editor-preview polygon { stroke: var(--preview-stroke) !important; stroke-width: 4px !important; stroke-dasharray: 6 4; }
  /* #diagram .nodeLabel[contenteditable="true"] { outline: 2px solid #1565c0; background: #fff; } */
  #multiSelectBadge { position: absolute; top: 8px; left: 8px; z-index: 2147483647; pointer-events: none; padding: 4px 10px; border-radius: 12px; background: var(--select-stroke); color: #fff; font: 13px/1.3 sans-serif; }
  #centerColumn > #output { flex: 1; min-height: 0; height: auto; }
  .note-dot { stroke: #fff; stroke-width: 1.5; pointer-events: none; }`;

export const mainDiagramMarkup = `    <div id="multiSelectBadge" hidden></div>
    <div id="output">
      <div id="diagram"></div>
      <div id="error"></div>
    </div>`;

export function insertMainDiagram(parent: Element) {
    const style = document.createElement("style");
    style.textContent = mainDiagramStyle;
    document.head.append(style);
    parent.insertAdjacentHTML("beforeend", mainDiagramMarkup);
}
