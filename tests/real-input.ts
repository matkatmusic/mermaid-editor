import { executeExpression, send, waitForRender } from "./cdp.ts";

// ponytail: node runs these tests with type stripping, which rejects enum syntax, so these are const objects.
export const Modifier = { None: 0, Alt: 1, Control: 2, Meta: 4, Shift: 8 } as const;

export const KeyName = {
    Backspace: "Backspace", Delete: "Delete", Escape: "Escape", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown",
    Z: "z", UpperZ: "Z", S: "s", F: "f", Equal: "=", Plus: "+", Minus: "-", GreaterThan: ">", LessThan: "<",
} as const;
type KeyNameValue = (typeof KeyName)[keyof typeof KeyName];

const KEY_CODES: Record<KeyNameValue, { code: string; windowsVirtualKeyCode: number }> = {
    Backspace: { code: "Backspace", windowsVirtualKeyCode: 8 },
    Delete: { code: "Delete", windowsVirtualKeyCode: 46 },
    Escape: { code: "Escape", windowsVirtualKeyCode: 27 },
    ArrowUp: { code: "ArrowUp", windowsVirtualKeyCode: 38 },
    ArrowDown: { code: "ArrowDown", windowsVirtualKeyCode: 40 },
    z: { code: "KeyZ", windowsVirtualKeyCode: 90 },
    Z: { code: "KeyZ", windowsVirtualKeyCode: 90 },
    s: { code: "KeyS", windowsVirtualKeyCode: 83 },
    f: { code: "KeyF", windowsVirtualKeyCode: 70 },
    "=": { code: "Equal", windowsVirtualKeyCode: 187 },
    "+": { code: "Equal", windowsVirtualKeyCode: 187 },
    "-": { code: "Minus", windowsVirtualKeyCode: 189 },
    ">": { code: "Period", windowsVirtualKeyCode: 190 },
    "<": { code: "Comma", windowsVirtualKeyCode: 188 },
};

// Presses and releases one key with the real keyboard path of the browser.
export async function pressKey(keyName: KeyNameValue, modifiers: number = Modifier.None) {
    const keyEvent = { key: keyName, modifiers, ...KEY_CODES[keyName] };
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...keyEvent });
    await send("Input.dispatchKeyEvent", { type: "keyUp", ...keyEvent });
    await executeExpression("editorActionPromise");
    await waitForRender();
}

// Presses and releases the left mouse button at the center of the node.
export async function clickNodeWithMouse(id: string, modifiers: number = Modifier.None) {
    const center = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const node = document.querySelector('#diagram [id*="flowchart-${id}-"]');
        node.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = node.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })())`));
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount: 1, modifiers });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount: 1, modifiers });
    await waitForRender();
}

export async function getHighlightedNodeIds(): Promise<string[]> {
    const json = await executeExpression(`JSON.stringify([...document.querySelectorAll('#diagram .editor-selected')].map((el) => el.id.match(/flowchart-(.+)-\\d+$/)[1]).sort())`);
    return JSON.parse(json);
}
