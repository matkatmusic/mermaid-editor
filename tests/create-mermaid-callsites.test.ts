// Behavioral checks for scripts/create-mermaid/mermaid.ts. Run alone: node --test tests/create-mermaid-callsites.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mermaidForFile } from "../scripts/create-mermaid/mermaid.ts";

test("test_mermaidForFile_wiresACallSiteToTheSameFileFunctionAndItsExitBack", () => {
    // Call site links into the function entry and its exit links back; the function keeps its standalone chain.
    const source = 'function helper() { return 1; }\nfunction main() { const x = helper(); }\n';
    const result = mermaidForFile("z.ts", source);
    assert.ok(result.includes("B_x_equals_helper --> B_helper\n"));
    assert.ok(result.includes("B_return_1 --> B_x_equals_helper\n"));
    assert.ok(result.includes("B_helper --> B_return_1\n"));
});

test("test_mermaidForFile_everyExitOfACalledFunctionPointsBackToTheCallSite", () => {
    // A function with two return points wires both exits back to the single call site.
    const source = 'function pick(x) { if (x) { return 1; } return 2; }\nfunction main() { const r = pick(1); }\n';
    const result = mermaidForFile("z.ts", source);
    assert.ok(result.includes("B_r_equals_pick_1 --> B_pick\n"));
    assert.ok(result.includes("B_return_1 --> B_r_equals_pick_1\n"));
    assert.ok(result.includes("B_return_2 --> B_r_equals_pick_1\n"));
});

test("test_mermaidForFile_afunctionCalledFromThreeSitesPointsItsExitBackToAllThree", () => {
    // Three call sites: the function's single exit points back to each of the three call sites.
    const source = 'function helper() { return 1; }\nfunction main() { const a = helper(); const b = helper(); const c = helper(); }\n';
    const result = mermaidForFile("z.ts", source);
    assert.ok(result.includes("B_return_1 --> B_a_equals_helper\n"));
    assert.ok(result.includes("B_return_1 --> B_b_equals_helper\n"));
    assert.ok(result.includes("B_return_1 --> B_c_equals_helper\n"));
});
