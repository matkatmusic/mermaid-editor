export const inspectorNoticeStyle = `  #inspectorNotice { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 2147483646; padding: 8px 14px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--bg); color: var(--text); box-shadow: 0 4px 16px rgba(0,0,0,0.25); font: 14px sans-serif; }`;

export const inspectorNoticeMarkup = `<div id="inspectorNotice" role="alert" hidden></div>`;

export function insertInspectorNotice(parent: Element) {
    const style = document.createElement("style");
    style.textContent = inspectorNoticeStyle;
    document.head.append(style);
    parent.insertAdjacentHTML("beforeend", inspectorNoticeMarkup);
}
