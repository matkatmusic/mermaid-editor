// import { executeExpression, waitMilliseconds } from './cdp.ts';
import { executeExpression, send, waitMilliseconds } from './cdp.ts';
import { resetEditorFixture } from './editor-helpers.ts';

// Two paths and one decision.
export const PATH_VIEW_SOURCE = [
    'flowchart TD',
    '  B_START["Start"]',
    '  Q_ASK{{"Ask?"}}',
    '  Q_CHOICE_ASK_YES["Yes"]',
    '  Q_CHOICE_ASK_NO["No"]',
    '  B_YES["Yes block"]',
    '  B_NO["No block"]',
    '  B_END["End"]',
    '  B_START --> Q_ASK',
    '  Q_ASK --> Q_CHOICE_ASK_YES',
    '  Q_ASK --> Q_CHOICE_ASK_NO',
    '  Q_CHOICE_ASK_YES --> B_YES',
    '  Q_CHOICE_ASK_NO --> B_NO',
    '  B_YES --> B_END',
    '  B_NO --> B_END',
].join('\n');

export async function loadPathViewSource(source: string = PATH_VIEW_SOURCE) {
    await resetEditorFixture();
    await executeExpression(`showOpenedFile('/tmp/path-view.mmd', ${JSON.stringify(source)})`);
    await waitMilliseconds(1000);
}

export async function readShownNodeIds(): Promise<string[]> {
    // return executeExpression("JSON.stringify([...document.querySelectorAll('#diagram g.node')].map((el) => el.id.match(/flowchart-(.+)-\\d+$/)[1]).sort())").then(JSON.parse);
    return executeExpression<string>("JSON.stringify([...document.querySelectorAll('#diagram g.node')].map((el) => el.id.match(/flowchart-(.+)-\\d+$/)[1]).sort())").then(JSON.parse);
}

export async function readShownEdgeIds(): Promise<string[]> {
    // return executeExpression("JSON.stringify([...document.querySelectorAll('#diagram path.flowchart-link')].map((el) => el.dataset.id).sort())").then(JSON.parse);
    return executeExpression<string>("JSON.stringify([...document.querySelectorAll('#diagram path.flowchart-link')].map((el) => el.dataset.id).sort())").then(JSON.parse);
}

export async function readErrorLog(): Promise<string> {
    return executeExpression("document.getElementById('errorLog').textContent");
}

// Presses and releases the left mouse button at the center of the element.
export async function clickButtonWithMouse(selector: string) {
    // const center = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const center: { x: number; y: number } = JSON.parse(await executeExpression<string>(`JSON.stringify((() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        element.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })())`));
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: center.x, y: center.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: center.x, y: center.y, button: 'left', clickCount: 1 });
    await waitMilliseconds(800);
}
