import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitForRender } from "./cdp.ts";

registerBrowserHooks(import.meta.url);

interface RecordedElement {
    tag: string;
    id: string | null;
    class: string | null;
    parentId: string | null;
    styles: Record<string, string>;
}

const FIXTURE_PATH = join(import.meta.dirname, "page-layout.fixture.json");

test("test_page_elements_and_styles_match_the_recorded_page", async () => {
    // Scenario: moving the page markup to TypeScript must not change how the page looks.
    // Step: the page finishes drawing.
    await waitForRender();

    // Step: record each element that has an id or a class, in document order, with its computed styles.
    const recordedElements = await executeExpression<string>(`(() => {
        // The loaded path holds a random folder name, so its width changes per run.
        document.getElementById('status').textContent = '/fixed/diagrams/accountability.mmd';
        const styleNames = ['display', 'position', 'color', 'background-color', 'border-top', 'margin', 'padding', 'width', 'height', 'font-size', 'z-index'];
        return JSON.stringify(Array.from(document.querySelectorAll('[id], [class]'), (element) => {
            const computedStyle = getComputedStyle(element);
            return {
                tag: element.tagName,
                id: element.getAttribute('id'),
                class: element.getAttribute('class'),
                parentId: element.parentElement?.closest('[id]')?.getAttribute('id') ?? null,
                styles: Object.fromEntries(styleNames.map((styleName) => [styleName, computedStyle.getPropertyValue(styleName)])),
            };
        }));
    })()`).then((text) => JSON.parse(text) as RecordedElement[]);

    // Step: the page matches the recorded page, element by element and style by style.
    const fixtureElements = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as RecordedElement[];
    assert.deepEqual(recordedElements, fixtureElements);
});
