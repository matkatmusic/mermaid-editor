import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

async function clickNewButton() {
    await resetEditorFixture();
    await executeExpression("document.getElementById('newBtn').click()");
    await waitMilliseconds(1000);
}

test("test_new_document_renders_its_node_without_an_error", async () => {
    await clickNewButton();
    assert.equal(await executeExpression("document.getElementById('error').textContent"), "");
    assert.equal(await executeExpression("errorLog.textContent"), "");
    assert.equal(await executeExpression("document.querySelectorAll('#diagram g.node').length"), 1);
});

test("test_new_document_node_is_inside_the_visible_output_area", async () => {
    await clickNewButton();
    const measured = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const output = document.getElementById('output');
        const outputRect = output.getBoundingClientRect();
        const rect = document.querySelector('#diagram g.node').getBoundingClientRect();
        return { node: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, visible: { left: outputRect.left + output.clientLeft, right: outputRect.left + output.clientLeft + output.clientWidth, top: outputRect.top + output.clientTop, bottom: outputRect.top + output.clientTop + output.clientHeight } };
    })())`));
    assert.ok(measured.node.left >= measured.visible.left && measured.node.right <= measured.visible.right, JSON.stringify(measured));
    assert.ok(measured.node.top >= measured.visible.top && measured.node.bottom <= measured.visible.bottom, JSON.stringify(measured));
});

test("test_new_document_node_is_drawn_and_not_clipped_by_a_zero_size_svg", async () => {
    await clickNewButton();
    // A click at the middle of the node must hit the node itself; a clipped node hits the page behind it.
    const hitNodeId = await executeExpression(`(() => {
        const node = document.querySelector('#diagram g.node');
        const rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const hitNode = hit && hit.closest('g.node');
        return hitNode ? hitNode.id : 'hit: ' + (hit ? hit.tagName + '#' + hit.id : 'nothing');
    })()`);
    const nodeId = await executeExpression("document.querySelector('#diagram g.node').id");
    assert.equal(hitNodeId, nodeId);
});

test("test_a_diagram_with_two_unconnected_nodes_draws_both_nodes", async () => {
    await resetEditorFixture();
    await executeExpression("codeBox.value = 'flowchart TD\\n  B_ONE[One]\\n  B_TWO[Two]'; codeBox.dispatchEvent(new Event('input')); render()");
    await waitMilliseconds(1000);
    const hitNodeIds: string[] = JSON.parse(await executeExpression(`JSON.stringify([...document.querySelectorAll('#diagram g.node')].map((node) => {
        const rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const hitNode = hit && hit.closest('g.node');
        return hitNode ? hitNode.id : 'none';
    }))`));
    assert.equal(hitNodeIds.length, 2);
    assert.ok(hitNodeIds.every((hitNodeId) => hitNodeId.startsWith("diagram-") && hitNodeId.includes("flowchart-B_")), JSON.stringify(hitNodeIds));
});
