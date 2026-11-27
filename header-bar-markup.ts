export const headerBarStyle = `  /* #header { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line); } */
  /* The toolbar wraps to a second line instead of making the page wider than the window. */
  #header { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line); }
  #header button, #header select { padding: 6px 10px; }
  #fileMenu { position: relative; }
  #fileMenu > summary { cursor: pointer; padding: 6px 10px; list-style: none; }
  #fileMenu[open] > #fileMenuItems { position: absolute; top: 100%; left: 0; z-index: 30; display: flex; flex-direction: column; gap: 4px; padding: 4px; background: var(--bg); border: 1px solid var(--line); box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
  #mainZoomControls { display: inline-flex; gap: 4px; align-items: center; white-space: nowrap; }
  #searchControls { display: inline-flex; gap: 4px; align-items: center; white-space: nowrap; }
  #searchBox { position: relative; display: inline-flex; align-items: center; }
  #searchInput { padding: 6px 28px 6px 8px; }
  #header #searchClearBtn { position: absolute; right: 2px; padding: 0 6px; border: none; background: none; cursor: pointer; font-size: 16px; line-height: 1; }
  #zoomLevel { min-width: 4ch; text-align: right; font-variant-numeric: tabular-nums; }
  #status { font-size: 12px; color: var(--text-quiet); padding: 0 12px; }`;

export const headerBarMarkup = `<div id="header">
  <details id="fileMenu">
    <summary>File</summary>
    <div id="fileMenuItems">
      <button id="newBtn">New</button>
      <button id="saveBtn">Save</button>
      <button id="openFileBtn">Open file...</button>
      <button id="resetBtn">Reset</button>
      <button id="classesMenuBtn">Classes...</button>
      <details id="diagramsMenu">
        <summary>Diagrams</summary>
        <select id="diagramSelect">
          <option value="" disabled selected>Diagrams</option>
        </select>
      </details>
    </div>
    <input type="file" id="openFileInput" accept=".mmd,text/plain" style="display:none">
  </details>
  <div id="searchControls" role="search">
    <span id="searchBox">
      <input id="searchInput" type="text" placeholder="Search nodes" aria-label="Search nodes by name or text" autocomplete="off">
      <button id="searchClearBtn" type="button" aria-label="Clear search" hidden>&times;</button>
    </span>
    <button id="searchPreviousBtn" type="button" aria-label="Previous search result" hidden>&lsaquo;</button>
    <button id="searchNextBtn" type="button" aria-label="Next search result" hidden>&rsaquo;</button>
    <span id="searchCounter" aria-live="polite" hidden>0 / 0</span>
  </div>
  <label><input type="checkbox" id="darkModeToggle" checked> Dark mode</label>
  <button id="editorUndoBtn" aria-label="Undo edit">&#8630;</button>
  <button id="editorRedoBtn" aria-label="Redo edit">&#8631;</button>
  <span>Decisions:</span>
  <button id="previousDecisionBtn" aria-label="Previous decision" title="Previous decision">&larr;</button>
  <button id="nextDecisionBtn" aria-label="Next decision" title="Next decision">&rarr;</button>
  <span id="decisionCounter" aria-live="polite">0 / 0</span>
  <div id="mainZoomControls" role="group" aria-label="Main diagram zoom">
    <!-- <span>Zoom:</span> -->
    <button id="zoomInBtn" type="button" aria-label="Zoom main diagram in">+</button>
    <button id="zoomOutBtn" type="button" aria-label="Zoom main diagram out">−</button>
    <button id="zoomResetBtn" type="button" aria-label="Reset main diagram zoom to 100%">100%</button>
    <output id="zoomLevel" aria-live="polite">100%</output>
  </div>
  <label><input type="checkbox" id="functionsOnlyToggle"> Functions only</label>
  <button id="exportAllPathsBtn" type="button">Export all paths</button>
  <button id="onePathViewBtn" type="button" aria-pressed="false">One path view</button>
  <span id="pathViewControls" hidden>
    <button id="previousViewPathBtn" type="button" aria-label="Previous path">&lt;</button>
    <output id="viewPathLabel" aria-live="polite"></output>
    <button id="nextViewPathBtn" type="button" aria-label="Next path">&gt;</button>
    <button id="copyPathCommandBtn" type="button">Copy command</button>
    <button id="fullDiagramBtn" type="button">Show full diagram</button>
  </span>
  <button id="downstreamViewBtn" type="button" aria-pressed="false">Downstream</button>
  <span id="downstreamViewControls" hidden>
    <button id="backDownstreamViewBtn" type="button">Back</button>
    <button id="resetDownstreamViewBtn" type="button">Reset</button>
    <button id="copyDownstreamCommandBtn" type="button">Copy command</button>
  </span>
  <!-- <select id="diagramSelect">
    <option value="" disabled selected>Diagrams</option>
  </select> -->
  <span id="currentFileName"></span>
  <div id="status"></div>
</div>`;

export function insertHeaderBar(parent: Element) {
    const style = document.createElement("style");
    style.textContent = headerBarStyle;
    document.head.append(style);
    parent.insertAdjacentHTML("beforeend", headerBarMarkup);
}
