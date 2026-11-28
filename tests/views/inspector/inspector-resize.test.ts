import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
// import { executeExpression, send, waitMilliseconds } from "../../cdp.ts";
import { executeExpression, send } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse } from "../../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const TWO_BLOCKS = ["flowchart TD", '  B_START["Start"]', '  B_END["End"]', "  B_START --> B_END"].join("\n");

type Measured = { centerColumnHeight: number; inspectorHeight: number; inspectorTop: number; outputBottom: number; outputHeight: number; textHeight: number; notesHeight: number; handleX: number; handleY: number; handleCursor: string };

async function measure(): Promise<Measured> {
    // return JSON.parse(await executeExpression(`JSON.stringify((() => {
    // })())`));
    return JSON.parse(await executeExpression<string>(`JSON.stringify((() => {
        const inspector = document.getElementById('nodeInspector').getBoundingClientRect();
        const output = document.getElementById('output').getBoundingClientRect();
        const handle = document.getElementById('nodeInspectorResizeHandle');
        const handleRect = handle.getBoundingClientRect();
        return {
            centerColumnHeight: document.getElementById('centerColumn').getBoundingClientRect().height,
            inspectorHeight: inspector.height, inspectorTop: inspector.top, outputBottom: output.bottom, outputHeight: output.height,
            textHeight: document.getElementById('nodeTextInput').getBoundingClientRect().height,
            notesHeight: document.getElementById('nodeNotesInput').getBoundingClientRect().height,
            handleX: handleRect.left + handleRect.width / 2, handleY: handleRect.top + handleRect.height / 2, handleCursor: getComputedStyle(handle).cursor,
        };
    })())`)) as Measured;
}

async function selectBlockWithNoDragHistory() {
    await resetEditorFixture();
    await setEditorSource(TWO_BLOCKS);
    // await waitMilliseconds(500);
    await clickNodeWithMouse("B_START");
    // await waitMilliseconds(300);
    // The page keeps the chosen height between tests, so drag the top edge far down to get back to the natural height.
    await dragHandleByMouse(3000);
}

async function dragHandleByMouse(deltaY: number) {
    const before = await measure();
    const x = before.handleX;
    const y = before.handleY;
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    const stepCount = 5;
    for (let step = 1; step <= stepCount; step++)
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: y + (deltaY * step) / stepCount, button: "left", buttons: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y: y + deltaY, button: "left", buttons: 0, clickCount: 1 });
    // await waitMilliseconds(200);
}

test("test_inspector_top_edge_handle_has_a_row_resize_cursor", async () => {
    // Step: select a block and measure the handle on the top edge of the inspector.
    await selectBlockWithNoDragHistory();
    const measured = await measure();
    // Step: the handle sits on the inspector's top edge and shows the row-resize cursor.
    assert.equal(measured.handleCursor, "row-resize");
    assert.ok(Math.abs(measured.handleY - measured.inspectorTop) <= 6, `handle y ${measured.handleY}px, inspector top ${measured.inspectorTop}px`);
});

test("test_dragging_the_top_edge_up_grows_the_inspector_and_the_text_boxes_and_shrinks_the_diagram_view", async () => {
    // Step: select a block and note the natural sizes.
    await selectBlockWithNoDragHistory();
    const before = await measure();
    // Step: drag the top edge up by 80px with a real mouse.
    await dragHandleByMouse(-80);
    const after = await measure();
    // Step: the inspector is 80px taller, both text boxes are 80px taller, the diagram view is at least 80px shorter, and nothing overlaps.
    // The page header may change its own height when the layout changes, so the diagram view is checked against the column that it shares with the inspector.
    assert.ok(Math.abs(after.inspectorHeight - before.inspectorHeight - 80) <= 2, `inspector ${before.inspectorHeight}px to ${after.inspectorHeight}px`);
    assert.ok(Math.abs(after.textHeight - before.textHeight - 80) <= 2, `node text box ${before.textHeight}px to ${after.textHeight}px`);
    assert.ok(Math.abs(after.notesHeight - before.notesHeight - 80) <= 2, `notes box ${before.notesHeight}px to ${after.notesHeight}px`);
    assert.ok(before.outputHeight - after.outputHeight >= 78, `diagram view ${before.outputHeight}px to ${after.outputHeight}px`);
    assert.ok(Math.abs(after.outputHeight + after.inspectorHeight - after.centerColumnHeight) <= 1, `diagram view ${after.outputHeight}px + inspector ${after.inspectorHeight}px, column ${after.centerColumnHeight}px`);
    assert.ok(after.outputBottom <= after.inspectorTop + 1, `diagram view bottom ${after.outputBottom}px, inspector top ${after.inspectorTop}px`);
});

test("test_dragging_the_top_edge_down_cannot_make_the_inspector_shorter_than_its_natural_height", async () => {
    // Step: select a block, then drag the top edge down by 60px.
    await selectBlockWithNoDragHistory();
    const before = await measure();
    await dragHandleByMouse(60);
    const after = await measure();
    // Step: the inspector keeps its natural height.
    assert.ok(Math.abs(after.inspectorHeight - before.inspectorHeight) <= 1, `inspector ${before.inspectorHeight}px to ${after.inspectorHeight}px`);
});

test("test_dragging_the_top_edge_far_up_stops_at_half_of_the_diagram_view_area", async () => {
    // Step: select a block, then drag the top edge up by 3000px.
    await selectBlockWithNoDragHistory();
    await dragHandleByMouse(-3000);
    const after = await measure();
    // Step: the inspector is half of the space that the diagram view and the inspector share.
    const sharedHeight = after.outputHeight + after.inspectorHeight;
    assert.ok(Math.abs(after.inspectorHeight - sharedHeight / 2) <= 2, `inspector ${after.inspectorHeight}px, shared ${sharedHeight}px`);
});

test("test_the_chosen_inspector_height_stays_when_another_block_is_selected", async () => {
    // Step: select a block and drag the top edge up by 80px.
    await selectBlockWithNoDragHistory();
    const before = await measure();
    await dragHandleByMouse(-80);
    // Step: select another block.
    await clickNodeWithMouse("B_END");
    // await waitMilliseconds(300);
    const after = await measure();
    // Step: the inspector keeps the taller height.
    assert.ok(Math.abs(after.inspectorHeight - before.inspectorHeight - 80) <= 2, `inspector ${before.inspectorHeight}px to ${after.inspectorHeight}px`);
});
