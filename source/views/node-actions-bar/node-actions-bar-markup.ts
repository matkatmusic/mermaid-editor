export const nodeActionsBarStyle = `  #nodeActions { display: none; gap: 6px; align-items: center; flex-wrap: wrap; padding: 8px 12px; border-bottom: 1px solid var(--line); }
  /* #nodeActions.open { display: flex; } */
  #nodeActions .removal-only { display: none; }
  #nodeActions.removing .removal-only { display: inline-block; }`;

export const nodeActionsBarMarkup = `    <div id="nodeActions" aria-live="polite">
      <span id="selectedNode"></span>
      <button id="addQuestionAfterBtn">Add question after</button>
      <button id="addBlockAfterBtn">Add block after</button>
      <button id="removeQuestionBtn">Remove question</button>
      <button id="removeBlockBtn">Remove block</button>
      <button id="addChoiceBtn">Add choice</button>
      <button id="removeChoiceBtn">Remove choice</button>
    <!-- <button id="nextRemovalPathBtn" class="removal-only">Next replacement path</button> -->
    <!-- <button id="confirmRemoveQuestionBtn" class="removal-only">Confirm removal</button> -->
    <!-- <button id="cancelRemoveQuestionBtn" class="removal-only">Cancel removal</button> -->
    <!-- <button id="editorUndoBtn">Undo edit</button> -->
    <!-- <button id="editorRedoBtn">Redo edit</button> -->
    </div>`;

export function insertNodeActionsBar(parent: Element) {
    const style = document.createElement("style");
    style.textContent = nodeActionsBarStyle;
    document.head.append(style);
    parent.insertAdjacentHTML("beforeend", nodeActionsBarMarkup);
}
