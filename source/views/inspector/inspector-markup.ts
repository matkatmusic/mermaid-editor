export const inspectorStyle = `  #nodeActions[inert], #nodeInspector [inert] { opacity: 0.5; }
  /* #nodeInspector { position: fixed; z-index: 20; box-sizing: border-box; width: 320px; padding: 12px 16px 16px; background: var(--bg); border: 1px solid var(--line-soft); border-radius: 22px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); font-family: monospace; } */
  #nodeInspector { position: relative; box-sizing: border-box; flex: none; display: flex; flex-direction: column; gap: 8px; padding: 8px; border-top: 1px solid var(--line); font-family: monospace; }
  /* #nodeInspector[hidden] { visibility: hidden; } */
  #nodeInspector[hidden] { opacity: 0.5; pointer-events: none; }
  #nodeInspector h2 { display: none; }
  #nodeTextInput { flex: 1; min-width: 0; box-sizing: border-box; resize: none; padding: 6px 8px; border: 2px solid var(--border-input); border-radius: 4px; font: inherit; text-align: center; }
  #nodeInspector .inspector-text-row { margin-bottom: 0; }
  /* Retired by task 68: Notes no longer sits beside the Node Name box.
  #nodeIdentityNotesRow { display: flex; align-items: stretch; gap: 8px; flex-wrap: wrap; }
  #nodeIdentityBox { flex: 1 1 280px; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  #nodeIdentityNotesRow #nodeNotesRow { align-items: stretch; }
  #nodeIdentityNotesRow #nodeNotesInput { align-self: stretch; }
  */
  #nodeIdentityBox { display: flex; flex-direction: column; gap: 4px; }
  #nodeTextNotesRow { flex: 1 1 auto; min-height: 0; display: flex; align-items: stretch; gap: 8px; }
  #nodeTextColumn, #nodeNotesRow { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; }
  #nodeTextColumn > .inspector-text-row, #nodeNotesRow > .inspector-text-row { flex: 1 1 auto; min-height: 0; align-items: stretch; }
  #nodeTextColumn > .inspector-text-row > span, #nodeNotesRow > .inspector-text-row > span { align-self: center; }
  #nodeInspectorResizeHandle { position: absolute; top: -3px; left: 0; right: 0; height: 6px; z-index: 5; cursor: row-resize; }
  #nodeNotesRow[hidden] { display: none; }
  .inspector-hint { margin-top: 2px; font-size: 10px; line-height: 12px; color: var(--text-quiet); text-align: right; }
  #nodeKindRow { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; font-size: 13px; }
  #nodeKindRow label { display: flex; align-items: center; gap: 4px; }
  #nodeKindRow input[type="checkbox"] { width: 16px; height: 16px; margin: 0; }
  /* The decision shape switch: a native checkbox drawn as a slider; knob left = hexagon, knob right = diamond. */
  #decisionShapeRow[hidden] { display: none; }
  #nodeKindRow #decisionShapeSwitch { appearance: none; width: 34px; height: 18px; border-radius: 9px; background: var(--border-input); position: relative; cursor: pointer; }
  #decisionShapeSwitch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--bg); transition: left 0.15s; }
  #decisionShapeSwitch:checked::after { left: 18px; }
  #decisionShapeSwitch:focus-visible { outline: 2px solid var(--select-stroke); outline-offset: 2px; }
  #nodeNameInput { flex: 1; min-width: 0; box-sizing: border-box; padding: 6px 8px; border: 2px solid var(--border-input); border-radius: 4px; font: inherit; }
  #nodeNameCheck { flex: 0 1 auto; min-width: 0; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
  #nodeNameCheck.error { color: #b00020; }
  #nodeNotesInput { flex: 1; min-width: 0; box-sizing: border-box; resize: none; padding: 6px 8px; border: 2px solid var(--border-input); border-radius: 4px; font: inherit; }
  /* #nodeNotesRow { flex: 1 1 220px; min-width: 220px; } */
  /* #nodeNotesRow[hidden] { display: none; } */
  #inspectorBottomRow { display: flex; align-items: center; gap: 8px; }
  #inspectorBottomRow .inspector-grid:not([hidden]) { display: flex; gap: 8px; flex-wrap: wrap; }
  /* #inspectorBottomRow #nodeInspectorActions { flex: 1 0 100%; min-width: 0; } */
  #inspectorBottomRow #nodeInspectorButtonsRow:not([hidden]) { flex: 1 0 100%; min-width: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  #inspectorBottomRow #nodeInspectorActions:not([hidden]) { display: contents; }
  #inspectorBottomRow .span-2, #nodeInspectorDismissBtn { margin: 0; }
  #nodeInspectorDismissBtn { display: none !important; }
  #inspectorBottomRow { flex-wrap: wrap; }
  #inspectorBottomRow #nodeInspectorControls:not([hidden]) { display: contents; }
  #inspectorBottomRow #nodeClassRow { flex: 1 1 240px; min-width: 0; }
  /* Retired by task 98 layout change: the align buttons moved into the kind row.
  #nodeAlignRow { order: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: 13px; }
  #nodeAlignRow[hidden] { display: none; }
  */
  #nodeAlignRow { display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; }
  #nodeAlignRow[hidden] { display: none; }
  #nodeAlignRow > span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .align-button-row { display: flex; gap: 4px; }
  .align-button-row button { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: 1px solid var(--line); border-radius: 6px; background: var(--bg-light); color: var(--text); cursor: pointer; }
  .align-button-row button[aria-pressed="true"] { background: var(--select-stroke); border-color: var(--select-stroke); color: var(--bg); }
  .align-button-row button:focus-visible { outline: 2px solid var(--select-stroke); outline-offset: 2px; }
  #inspectorBottomRow #destinationRow:not([hidden]) { flex: 1 1 240px; min-width: 0; }
  #classPickerList { top: auto; bottom: 100%; }
  .inspector-grid:not([hidden]) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .inspector-grid button { padding: 2.5px 10px; }
  .inspector-destination-row:not([hidden]) { display: flex; align-items: center; gap: 6px; }
  .inspector-destination-row select { flex: 1; min-width: 0; padding: 6px 8px; font: inherit; }
  .inspector-destination-row { position: relative; }
  .inspector-destination-row input { flex: 1; min-width: 0; box-sizing: border-box; padding: 6px 8px; border: 2px solid var(--border-input); border-radius: 4px; font: inherit; }
  #destinationList { position: absolute; left: 0; right: 0; bottom: 100%; z-index: 25; max-height: 40vh; overflow: auto; display: flex; flex-direction: column; background: var(--bg); border: 1px solid var(--line); box-shadow: 0 2px 6px rgba(0,0,0,0.25); }
  #destinationList[hidden] { display: none; }
  .destination-option { flex-shrink: 0; padding: 6px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
  .destination-option:hover, .destination-option[aria-selected="true"] { background: var(--bg-light); }
  .span-2 { grid-column: 1 / -1; }
  #nodeInspectorDismissBtn { margin: 8px; }
  .class-swatch { flex: none; display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 2px solid #999; box-sizing: border-box; }
  #classPicker { position: relative; flex: 1; min-width: 0; }
  #classPickerBtn { display: flex; align-items: center; gap: 6px; width: 100%; box-sizing: border-box; padding: 6px 8px; border: 2px solid var(--border-input); border-radius: 4px; background: var(--bg); color: var(--text); font: inherit; cursor: pointer; }
  #classPickerList { position: absolute; /* top: 100%; overridden below (line 81) to open upward; kept here collapses the list to 2px */ left: 0; min-width: 100%; width: max-content; z-index: 25; display: flex; flex-direction: column; /* max-height: 220px; retired by task 105: the script sets the height from the room in the window */ overflow: auto; background: var(--bg); border: 1px solid var(--line); box-shadow: 0 2px 6px rgba(0,0,0,0.25); }
  #classPickerList[hidden] { display: none; }
  .class-picker-row { display: flex; align-items: center; gap: 6px; white-space: nowrap; padding: 6px 8px; border: none; background: none; color: var(--text); font: inherit; text-align: left; cursor: pointer; }
  .class-picker-row:hover { background: var(--bg-light); }`;

export const inspectorMarkup = `<aside id="nodeInspector" role="dialog" aria-labelledby="nodeInspectorTitle" hidden>
  <div id="nodeInspectorResizeHandle"></div>
  <h2 id="nodeInspectorTitle"></h2>
  <!-- Retired: the free-form Node Identifier box is replaced by the type row and the Node Name box below.
  <label class="inspector-text-row"><span>Node Identifier:</span><input id="nodeIdInput" type="text" spellcheck="false" autocomplete="off"></label>
  <div id="nodeIdError" role="alert" hidden></div>
  -->
  <div id="nodeIdentityBox">
  <div id="nodeKindRow">
    <label><input id="nodeKindStatic" type="checkbox" disabled> Static</label>
    <label><input id="nodeKindQuestion" type="checkbox" disabled> Decision</label>
    <label id="decisionShapeRow" hidden><span aria-hidden="true">⬣</span><input id="decisionShapeSwitch" type="checkbox" role="switch" aria-label="Decision shape: hexagon on the left, diamond on the right"><span aria-hidden="true">🔶</span></label>
    <label><input id="nodeKindChoice" type="checkbox" disabled> Choice</label>
    <span id="nodeParentLabel"></span>
    <div id="nodeAlignRow" hidden>
      <span>Text align</span>
      <div class="align-button-row" role="group" aria-label="Text justification">
        <button type="button" data-justification="left" aria-label="Justify left" aria-pressed="false"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 3.5h12M2 8h7M2 12.5h10"/></svg></button>
        <button type="button" data-justification="center" aria-label="Justify center" aria-pressed="false"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 3.5h12M4.5 8h7M3 12.5h10"/></svg></button>
        <button type="button" data-justification="right" aria-label="Justify right" aria-pressed="false"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 3.5h12M7 8h7M4 12.5h10"/></svg></button>
      </div>
      <div class="align-button-row" role="group" aria-label="Text alignment">
        <button type="button" data-alignment="top" aria-label="Align top" aria-pressed="false"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 2.5h12"/><rect x="5" y="5.5" width="6" height="8" rx="1"/></svg></button>
        <button type="button" data-alignment="center" aria-label="Align center" aria-pressed="false"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="5" y="4" width="6" height="8" rx="1"/><path d="M1.5 8h3M11.5 8h3"/></svg></button>
        <button type="button" data-alignment="bottom" aria-label="Align bottom" aria-pressed="false"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="5" y="2.5" width="6" height="8" rx="1"/><path d="M2 13.5h12"/></svg></button>
      </div>
    </div>
  </div>
  <label class="inspector-text-row"><span>Node Name:</span><input id="nodeNameInput" type="text" spellcheck="false" autocomplete="off"><div id="nodeNameCheck" role="status"></div></label>
  </div>
  <div id="nodeTextNotesRow">
  <div id="nodeTextColumn">
  <label class="inspector-text-row"><span>Node text:</span><textarea id="nodeTextInput" rows="2"></textarea></label>
  <div id="nodeTextHint" class="inspector-hint">shift-enter: new line</div>
  </div>
  <div id="nodeNotesRow">
  <label class="inspector-text-row"><span>Notes:</span><textarea id="nodeNotesInput" rows="2"></textarea></label>
  <div id="nodeNotesHint" class="inspector-hint">shift-enter: new line</div>
  </div>
  </div>
  <div id="inspectorBottomRow">
  <div id="nodeClassRow" class="inspector-text-row">
    <span>Class:</span>
    <div id="classPicker">
      <button type="button" id="classPickerBtn"><span id="classPickerSwatch" class="class-swatch"></span><span id="classPickerLabel"></span></button>
      <div id="classPickerList" hidden></div>
    </div>
  </div>
  <!-- Retired by task 98 layout change: the align buttons moved into #nodeKindRow.
  <div id="nodeAlignRow" hidden>
    <span>Text align</span>
    <div class="align-button-row" role="group" aria-label="Text justification">
      <button type="button" data-justification="left" aria-label="Justify left" aria-pressed="false"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 3.5h12M2 8h7M2 12.5h10"/></svg></button>
      <button type="button" data-justification="center" aria-label="Justify center" aria-pressed="false"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 3.5h12M4.5 8h7M3 12.5h10"/></svg></button>
      <button type="button" data-justification="right" aria-label="Justify right" aria-pressed="false"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 3.5h12M7 8h7M4 12.5h10"/></svg></button>
    </div>
    <div class="align-button-row" role="group" aria-label="Text alignment">
      <button type="button" data-alignment="top" aria-label="Align top" aria-pressed="false"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 2.5h12"/><rect x="5" y="5.5" width="6" height="8" rx="1"/></svg></button>
      <button type="button" data-alignment="center" aria-label="Align center" aria-pressed="false"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="5" y="4" width="6" height="8" rx="1"/><path d="M1.5 8h3M11.5 8h3"/></svg></button>
      <button type="button" data-alignment="bottom" aria-label="Align bottom" aria-pressed="false"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="5" y="2.5" width="6" height="8" rx="1"/><path d="M2 13.5h12"/></svg></button>
    </div>
  </div>
  -->
  <div id="nodeInspectorControls" class="inspector-grid">
    <button id="nodeInspectorDismissBtn" class="span-2">Cancel</button>
    <label id="destinationRow" class="inspector-destination-row span-2"><span>Destination:</span><input id="destinationInput" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="destinationList" autocomplete="off" spellcheck="false"><select id="destinationSelect" hidden tabindex="-1"></select><div id="destinationList" role="listbox" hidden></div></label>
    <!-- Moved by task 106 into the buttons row: <button id="walkBackBtn" class="span-2">Walk back</button> -->
  </div>
  <div id="nodeInspectorButtonsRow"><button id="walkBackBtn" type="button" title="Select the node that comes before this node. If more than one node comes before it, a list asks which one.">Walk back</button><div id="nodeInspectorActions" class="inspector-grid"></div></div>
  <div id="nodeInspectorRemovalPreview" class="inspector-grid" hidden>
    <button id="nextRemovalPathBtn">Next replacement path</button>
    <button id="confirmRemoveQuestionBtn">Confirm removal</button>
    <button id="cancelRemoveQuestionBtn" class="span-2">Cancel removal</button>
  </div>
  </div>
</aside>`;

export const inspectorRetiredTemplateMarkup = `<!--
  Moved into #centerColumn under #output. A template, not a comment: the retired comment inside cannot nest.
-->
<template>
<aside id="nodeInspector" role="dialog" aria-labelledby="nodeInspectorTitle" hidden>
  <h2 id="nodeInspectorTitle"></h2>
  <label class="inspector-text-row"><span>Text:</span><input id="nodeTextInput" type="text"></label>
  <!-- Retired: category/color metadata is replaced by mermaid classDef/class lines (see class-defs.ts).
  <label id="nodeTypeRow" class="inspector-text-row"><span>Category:</span><input id="nodeTypeInput" type="text" list="nodeTypeOptions"></label>
  <datalist id="nodeTypeOptions">
    <option value="static"></option>
    <option value="goal"></option>
  </datalist>
  <label id="nodeTypeColorRow" class="inspector-text-row"><span>Color:</span><input id="nodeTypeColorInput" type="color"></label>
  -->
  <div id="nodeClassRow" class="inspector-text-row">
    <span>Class:</span>
    <div id="classPicker">
      <button type="button" id="classPickerBtn"><span id="classPickerSwatch" class="class-swatch"></span><span id="classPickerLabel"></span></button>
      <div id="classPickerList" hidden></div>
    </div>
  </div>
  <div id="nodeInspectorActions" class="inspector-grid"></div>
  <div id="nodeInspectorControls" class="inspector-grid">
    <button id="nodeInspectorDismissBtn" class="span-2">Cancel</button>
    <label id="destinationRow" class="inspector-destination-row span-2"><span>Destination:</span><select id="destinationSelect"></select></label>
  </div>
  <div id="nodeInspectorRemovalPreview" class="inspector-grid" hidden>
    <button id="nextRemovalPathBtn">Next replacement path</button>
    <button id="confirmRemoveQuestionBtn">Confirm removal</button>
    <button id="cancelRemoveQuestionBtn" class="span-2">Cancel removal</button>
  </div>
</aside>
</template>`;

export function insertInspector(parent: Element) {
    const style = document.createElement("style");
    style.textContent = inspectorStyle;
    document.head.append(style);
    parent.insertAdjacentHTML("beforeend", inspectorMarkup);
}

export function insertInspectorRetiredTemplate(parent: Element) {
    parent.insertAdjacentHTML("beforeend", inspectorRetiredTemplateMarkup);
}
