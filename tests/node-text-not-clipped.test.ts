import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
registerBrowserHooks(import.meta.url, openEditorDrawer);
const PUZZLE_SOURCE = readFileSync(join(process.cwd(), "tests", "puzzle-solver-rules-v2.fixture.mmd"), "utf8");
const FENCE = "#96;#96;#96;";
const TOLERANCE_PX = 1.5;
async function loadSource(source: string) {
    await resetEditorFixture();
    await setEditorSource(source);
    await waitMilliseconds(1500);
}
type TextLineReport = { nodeId: string; text: string; problems: string[] };
// For every text line of every block: the line box lies inside the shape box, and the browser really draws the ends of the line
// (a point at each end of the line hits the label; a clipped part hits the shape or the page behind it).
async function findTextLineProblems(): Promise<{ nodeCount: number; lineCount: number; reports: TextLineReport[] }> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const reports = [];
        let lineCount = 0;
        const outputBox = document.getElementById('output').getBoundingClientRect();
        const nodes = [...document.querySelectorAll('#diagram g.node')];
        for (const node of nodes) {
            const label = node.querySelector('.nodeLabel');
            if (!label)
                continue;
            const shape = node.querySelector('rect.label-container, polygon.label-container, rect, polygon');
            node.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
            const shapeBox = shape.getBoundingClientRect();
            const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
            for (let current = walker.nextNode(); current; current = walker.nextNode()) {
                if (!current.data.trim())
                    continue;
                const range = document.createRange();
                range.selectNodeContents(current);
                for (const rect of range.getClientRects()) {
                    if (rect.width === 0)
                        continue;
                    lineCount++;
                    const problems = [];
                    if (rect.left < shapeBox.left - ${TOLERANCE_PX}) problems.push('left of shape by ' + (shapeBox.left - rect.left));
                    if (rect.right > shapeBox.right + ${TOLERANCE_PX}) problems.push('right of shape by ' + (rect.right - shapeBox.right));
                    if (rect.top < shapeBox.top - ${TOLERANCE_PX}) problems.push('above shape by ' + (shapeBox.top - rect.top));
                    if (rect.bottom > shapeBox.bottom + ${TOLERANCE_PX}) problems.push('below shape by ' + (rect.bottom - shapeBox.bottom));
                    const middleY = (rect.top + rect.bottom) / 2;
                    const middleX = (rect.left + rect.right) / 2;
                    const samples = { left: [rect.left + 1, middleY], right: [rect.right - 1, middleY], top: [middleX, rect.top + 3], bottom: [middleX, rect.bottom - 3] };
                    for (const [name, [x, y]] of Object.entries(samples)) {
                        // A block wider than the diagram pane runs under the drawer or the Phone view: that part is not on screen.
                        const isOnDiagramPane = x > outputBox.left && x < outputBox.right && y > outputBox.top && y < outputBox.bottom;
                        if (!isOnDiagramPane)
                            continue;
                        const hit = document.elementFromPoint(x, y);
                        if (!hit || !label.contains(hit))
                            problems.push('the ' + name + ' of the line is not drawn (hit ' + (hit ? hit.tagName + '#' + hit.id + '.' + (hit.getAttribute('class') ?? '') : 'nothing') + ' at ' + Math.round(x) + ',' + Math.round(y) + ')');
                    }
                    if (problems.length > 0)
                        reports.push({ nodeId: node.id, text: current.data.trim().slice(0, 40), problems });
                }
            }
        }
        return { nodeCount: nodes.length, lineCount, reports };
    })())`));
}
function describeReports(reports: TextLineReport[]) {
    return reports.slice(0, 12).map((report) => `${report.nodeId} "${report.text}": ${report.problems.join(", ")}`).join("\n");
}
test("test_every_text_line_of_the_puzzle_solver_diagram_is_inside_its_block_and_drawn", async () => {
    await loadSource(PUZZLE_SOURCE);
    const result = await findTextLineProblems();
    console.log(`MEASURED puzzle diagram: ${result.nodeCount} blocks, ${result.lineCount} text lines, ${result.reports.length} problem lines`);
    assert.ok(result.lineCount > 100, `only ${result.lineCount} lines`);
    assert.equal(result.reports.length, 0, `${result.reports.length} problem lines:\n${describeReports(result.reports)}`);
});
test("test_text_lines_of_unsized_and_sized_rectangles_and_hexagons_with_code_are_inside_and_drawn", async () => {
    const codeLabel = ["Build the range", "#96;rangeStart = file.beacons[i-1]; // newer beacon#96;", "#96;rangeEnd = file.beacons[i]; // older beacon#96;"].join("<br/>");
    const fencedLabel = ["Walk", FENCE, "if (a) {", "  go();", "}", FENCE, "done"].join("<br/>");
    const source = [
        "flowchart TD",
        `  B_UNSIZED["${codeLabel}"]`,
        `  B_SIZED["${codeLabel}"]`,
        `  B_LEFT["${codeLabel}"]`,
        '  B_SHORT["Yes. Walk from both ends, up to the script run"]',
        `  Q_UNSIZED{{"${codeLabel}"}}`,
        `  Q_SIZED{{"${codeLabel}"}}`,
        `  B_FENCED["${fencedLabel}"]`,
        "  B_UNSIZED --> B_SIZED --> B_LEFT --> B_SHORT --> Q_UNSIZED --> Q_SIZED --> B_FENCED",
        "%% ==size==: B_SIZED 700 140",
        "%% ==size==: B_LEFT 700 140",
        "%% ==align==: B_LEFT left center",
        "%% ==size==: B_SHORT 360 40",
        "%% ==size==: Q_SIZED 800 160",
    ].join("\n");
    await loadSource(source);
    const result = await findTextLineProblems();
    console.log(`MEASURED inline blocks: ${result.nodeCount} blocks, ${result.lineCount} text lines, ${result.reports.length} problem lines`);
    assert.equal(result.reports.length, 0, `${result.reports.length} problem lines:\n${describeReports(result.reports)}`);
});
