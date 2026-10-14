// Behavioral checks for scripts/create-mermaid/mermaid.ts. Run alone: node --test tests/create-mermaid-statements.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mermaidForFile } from "../scripts/create-mermaid/mermaid.ts";

test("test_mermaidForFile_chainsTopLevelStatementsFromTheFileBox", () => {
    // Scenario: a script with two top-level statements and no functions chains both from file box. Step: two const declarations.
    const source = 'const a = 1;\nconst b = 2;\n';
    const result = mermaidForFile("h.ts", source);
    // Verify: no function boxes exist; both statements chain in source order starting at the file box.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_h_ts["h.ts"]\n' +
        'B_a_equals_1["const a = 1"]\n' +
        'B_b_equals_2["const b = 2"]\n' +
        'B_h_ts --> B_a_equals_1 --> B_b_equals_2\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_h_ts fileRoot\n' +
        'class B_a_equals_1,B_b_equals_2 expression\n'
    );
});

test("test_mermaidForFile_chainsAnExpressionBodiedArrowConstFromItsTopBox", () => {
    // Scenario: an arrow-function const with an expression body (no braces) gets a top box and one chained expression box.
    const source = 'const double = (x) => x * 2;\n';
    const result = mermaidForFile("i.ts", source);
    // Verify: the top box is named for the const, and the expression itself becomes one box chained from it.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_i_ts["i.ts"]\n' +
        'B_double["double(x)"]\n' +
        'B_x_2["x * 2"]\n' +
        'B_double --> B_x_2\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_i_ts fileRoot\n' +
        'class B_double funcDecl\n' +
        'class B_x_2 expression\n'
    );
});

test("test_mermaidForFile_mapsOperatorWordsKeepsKeywordNamesAndStripsStringQuotesInIds", () => {
    // Reported bug: entry.type !== "user" produced Q_entry_"user" (type dropped, !== dropped, quotes kept).
    const source = 'function f(entry) {\n  if (entry.type !== "user") {\n    return null;\n  }\n}\n';
    const result = mermaidForFile("p.ts", source);
    assert.ok(result.includes("Q_entry_type_not_equals_user{"));
    // Labels escape embedded double-quotes so the renderer accepts them.
    assert.ok(result.includes('Q_entry_type_not_equals_user{"if( entry.type !== #quot;user#quot; )"}'));
});

test("test_mermaidForFile_processExitIsTerminalAndDoesNotLinkToTheNextStatement", () => {
    const source = 'function f() {\n  process.exit(0);\n  doNext();\n}\n';
    const result = mermaidForFile("q.ts", source);
    assert.ok(result.includes("B_f --> B_process_exit_0\n"));
    assert.ok(!result.includes("B_process_exit_0 -->"));
});

test("test_mermaidForFile_encodesBackslashAsEntitySoALiteralNewlineInAStringDoesNotBreakTheLabel", () => {
    const source = 'function f(s) {\n  for (const line of s.split("\\n")) {\n    use(line);\n  }\n}\n';
    const result = mermaidForFile("r.ts", source);
    assert.ok(result.includes('s.split(#quot;#92;n#quot;)'));
});
