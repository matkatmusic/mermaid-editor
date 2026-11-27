export const phoneStyle = `  #phoneWorkspace { flex: none; min-width: 0; min-height: 0; padding: 12px; box-sizing: border-box; border-left: 1px solid var(--line); display: flex; align-items: center; justify-content: center; background: var(--bg-card); }
  #phoneOutput { position: relative; aspect-ratio: 9 / 19.5; width: auto; height: 100%; max-width: 100%; max-height: 100%; border: 8px solid var(--border-strong); border-radius: 24px; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); }
  #phoneDiagramWrap { position: relative; flex: 1; min-height: 0; }
  #phoneDiagram { height: 100%; display: flex; flex-direction: column; }
  #phoneHistory { flex: 1 1 0; min-height: 0; overflow-y: auto; }
  #phoneFooter { flex: 0 1 auto; min-height: 0; max-height: 50%; overflow-y: auto; }
  .phone-block, .phone-question { width: 100%; box-sizing: border-box; padding: 16px 12px; color: #000; text-align: center; font: 14px/1.4 system-ui, sans-serif; }
  .phone-block { border-bottom: 1px solid var(--border-mid); width: calc(100% - 16px); overflow-x: auto; margin: 8px; }
  .phone-question { font-weight: 600; }
  .phone-choice-row { display: flex; width: 100%; gap: 8px; padding: 8px; box-sizing: border-box; overflow-x: auto; }
  .phone-choice-count { padding: 0 8px; color: #fff; font: 11px/1.3 system-ui, sans-serif; }
  .phone-choice { flex: 1 0 100px; box-sizing: border-box; border: none; border-radius: 8px; background: #eee; color: #000; padding: 14px 8px; font: 13px/1.3 system-ui, sans-serif; cursor: pointer; }
  .phone-choice-chosen { background: #9ed7a4; cursor: default; order: -1; }
  .phone-choice-declined { background: repeating-linear-gradient(45deg, #d8d8d8, #d8d8d8 6px, #c8c8c8 6px, #c8c8c8 12px); }
  .phone-choice-declined:not(:disabled) { cursor: pointer; }
  #phoneTopBar { flex: 0 0 10%; display: flex; gap: 8px; align-items: center; justify-content: center; border-bottom: 1px solid var(--border-mid); }
  .phone-undo { border: none; border-radius: 8px; background: #eee; color: #000; padding: 8px 14px; font: 13px/1.3 system-ui, sans-serif; cursor: pointer; }
  .phone-undo:disabled { opacity: 0.45; cursor: default; }
  #phoneDiagram.writing-all-paths [data-write-path] { pointer-events: none; opacity: 0.5; }
  #phoneDiagram button { transition: transform 80ms, box-shadow 80ms; }
  #phoneDiagram button:not(:disabled):hover { box-shadow: 0 0 0 2px var(--select-stroke); }
  #phoneDiagram button:not(:disabled):active { transform: translateY(3px); }
  .phone-decision-past, .phone-block-past { position: relative; }
  .phone-decision-past::after, .phone-block-past::after { content: ""; position: absolute; inset: 0; background: var(--mask); pointer-events: none; }
  #phoneStartPrompt { padding: 40px 24px; text-align: center; color: #000; font: 16px/1.4 system-ui, sans-serif; }
  .phone-clicked { animation: phone-clicked-pulse 0.75s ease-in-out 4; }
  @keyframes phone-clicked-pulse { 0%, 100% { outline: 4px solid transparent; } 50% { outline: 4px solid #ff9800; } }
  .phone-separator { display: block; height: 20px; border: none; background: #000; margin: 0; }
  .phone-decision:not(.phone-decision-past) .phone-question { font-size: 20px; margin-top: 20px; margin-bottom: 20px; }
  .phone-decision:not(.phone-decision-past) .phone-choice { font-size: 17px; }
  /* Code text in the Phone view is as small as the text of a picked choice button (.phone-choice, 13px), in every row. */
  #phoneDiagram code { overflow-wrap: anywhere; font-size: 13px; }`;

export const phoneMarkup = `  <div id="phoneWorkspace">
    <div id="phoneOutput">
    <div id="phoneDiagramWrap">
      <div id="phoneDiagram"></div>
    </div>
    </div>
  </div>`;

export function insertPhone(parent: Element) {
    const style = document.createElement("style");
    style.textContent = phoneStyle;
    document.head.append(style);
    parent.insertAdjacentHTML("beforeend", phoneMarkup);
}
