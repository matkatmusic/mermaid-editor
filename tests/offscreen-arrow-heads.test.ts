import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

// A chain of blocks with an edge from the last block back to the first, so one edge goes up and the others go down.
function buildChainSource(blockCount: number) {
    const ids = Array.from({ length: blockCount }, (_, index) => `B_N${index}`);
    return ["flowchart TD", ...ids.map((id) => `  ${id}["Block ${id}"]`), `  ${ids.join(" --> ")}`, `  ${ids[ids.length - 1]} --> ${ids[0]}`].join("\n");
}

async function loadChain(blockCount: number) {
    await resetEditorFixture();
    await setEditorSource(buildChainSource(blockCount));
    await waitMilliseconds(800);
}

async function setOutputScrollTop(scrollTop: number | "max") {
    const value = scrollTop === "max" ? "output.scrollHeight" : String(scrollTop);
    await executeExpression(`(() => { const output = document.getElementById('output'); output.scrollTop = ${value}; })()`);
    await waitMilliseconds(300);
}

// Scrolls so the middle of one edge sits exactly on the bottom edge of the visible area.
async function scrollEdgeMiddleToBottomEdge(edgeDataId: string) {
    await executeExpression(`(() => {
        const output = document.getElementById('output');
        const visibleBottom = output.getBoundingClientRect().top + output.clientTop + output.clientHeight;
        const rect = document.querySelector('#diagram path.flowchart-link[data-id="${edgeDataId}"]').getBoundingClientRect();
        output.scrollTop += rect.top + rect.height / 2 - visibleBottom;
    })()`);
    await waitMilliseconds(300);
}

interface HeadMeasure {
    edgeDataId: string;
    tip: { x: number; y: number };
    base: { x: number; y: number };
    rect: { top: number; bottom: number; left: number; right: number };
    fill: string;
}

interface HeadReport {
    visible: { top: number; bottom: number; left: number; right: number };
    heads: HeadMeasure[];
    normalMarkerFill: string;
}

// The arrow shape is Mermaid's marker path "M 0 0 L 11.5 7 L 0 14 z": the tip is (11.5, 7) and the middle of the base is (0, 7).
async function measureHeads(): Promise<HeadReport> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const output = document.getElementById('output');
        const outputRect = output.getBoundingClientRect();
        const left = outputRect.left + output.clientLeft;
        const top = outputRect.top + output.clientTop;
        const toScreen = (matrix, x, y) => { const point = new DOMPoint(x, y).matrixTransform(matrix); return { x: point.x, y: point.y }; };
        const heads = [...document.querySelectorAll('#diagram .offscreen-arrow-head')].map((head) => {
            const matrix = head.getScreenCTM();
            const rect = head.getBoundingClientRect();
            return {
                edgeDataId: head.dataset.edgeId,
                tip: toScreen(matrix, 11.5, 7),
                base: toScreen(matrix, 0, 7),
                rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
                fill: getComputedStyle(head).fill,
            };
        });
        const normalMarkerPath = document.querySelector('#diagram marker path.arrowMarkerPath');
        return {
            visible: { top, bottom: top + output.clientHeight, left, right: left + output.clientWidth },
            heads,
            normalMarkerFill: getComputedStyle(normalMarkerPath).fill,
        };
    })())`));
}

function findHead(report: HeadReport, edgeDataId: string) {
    return report.heads.find((head) => head.edgeDataId === edgeDataId);
}

const TOLERANCE_PX = 1;
const NEAR_EDGE_PX = 40;

test("test_no_extra_arrow_head_when_every_end_point_is_on_screen", async () => {
    await loadChain(3);
    const report = await measureHeads();
    assert.equal(report.heads.length, 0, JSON.stringify(report.heads));
});

test("test_an_edge_that_goes_down_off_the_bottom_gets_an_arrow_head_pointing_down_near_the_bottom_edge", async () => {
    await loadChain(14);
    await scrollEdgeMiddleToBottomEdge("L_B_N3_B_N4_0");
    const report = await measureHeads();
    const head = findHead(report, "L_B_N3_B_N4_0");
    assert.ok(head, JSON.stringify(report.heads));
    console.log(`MEASURED down head: ${JSON.stringify({ visibleBottom: report.visible.bottom, tip: head.tip, base: head.base, headRect: head.rect })}`);
    assert.ok(head.tip.y > head.base.y, `tip ${head.tip.y}, base ${head.base.y}`);
    assert.ok(Math.abs(head.tip.x - head.base.x) < Math.abs(head.tip.y - head.base.y), JSON.stringify(head));
    assert.ok(head.rect.bottom <= report.visible.bottom + TOLERANCE_PX, `head bottom ${head.rect.bottom}, visible bottom ${report.visible.bottom}`);
    assert.ok(head.rect.bottom >= report.visible.bottom - NEAR_EDGE_PX, `head bottom ${head.rect.bottom}, visible bottom ${report.visible.bottom}`);
});

test("test_an_edge_that_goes_up_off_the_top_gets_an_arrow_head_pointing_up_near_the_top_edge", async () => {
    await loadChain(14);
    await setOutputScrollTop("max");
    const report = await measureHeads();
    const head = findHead(report, "L_B_N13_B_N0_0");
    assert.ok(head, JSON.stringify(report.heads));
    assert.ok(head.tip.y < head.base.y, `tip ${head.tip.y}, base ${head.base.y}`);
    assert.ok(Math.abs(head.tip.x - head.base.x) < Math.abs(head.tip.y - head.base.y), JSON.stringify(head));
    assert.ok(head.rect.top >= report.visible.top - TOLERANCE_PX, `head top ${head.rect.top}, visible top ${report.visible.top}`);
    assert.ok(head.rect.top <= report.visible.top + NEAR_EDGE_PX, `head top ${head.rect.top}, visible top ${report.visible.top}`);
});

test("test_the_extra_arrow_head_is_gone_after_a_pan_that_brings_the_end_point_on_screen", async () => {
    await loadChain(14);
    await setOutputScrollTop("max");
    assert.ok(findHead(await measureHeads(), "L_B_N13_B_N0_0"));
    await setOutputScrollTop(0);
    const report = await measureHeads();
    assert.equal(findHead(report, "L_B_N13_B_N0_0"), undefined, JSON.stringify(report.heads));
});

test("test_the_extra_arrow_head_has_the_same_fill_as_the_normal_arrow_head", async () => {
    await loadChain(14);
    await setOutputScrollTop("max");
    const report = await measureHeads();
    const head = findHead(report, "L_B_N13_B_N0_0");
    assert.ok(head, JSON.stringify(report.heads));
    assert.equal(head.fill, report.normalMarkerFill);
});

test("test_after_a_zoom_out_the_extra_arrow_head_tip_is_inside_the_visible_area", async () => {
    await loadChain(14);
    await setOutputScrollTop("max");
    await executeExpression("document.getElementById('zoomOutBtn').click()");
    await waitMilliseconds(300);
    const report = await measureHeads();
    assert.ok(findHead(report, "L_B_N13_B_N0_0"), JSON.stringify(report.heads));
    for (const head of report.heads) {
        assert.ok(head.tip.y >= report.visible.top - TOLERANCE_PX && head.tip.y <= report.visible.bottom + TOLERANCE_PX, JSON.stringify(head));
        assert.ok(head.tip.x >= report.visible.left - TOLERANCE_PX && head.tip.x <= report.visible.right + TOLERANCE_PX, JSON.stringify(head));
    }
});
