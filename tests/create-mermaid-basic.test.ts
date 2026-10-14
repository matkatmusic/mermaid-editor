// Behavioral checks for scripts/create-mermaid/mermaid.ts. Run alone: node --test tests/create-mermaid-basic.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mermaidForFile, writeAllDiagrams } from "../scripts/create-mermaid/mermaid.ts";

function git(repoRoot: string, ...args: string[]): string {
    return execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" });
}

test("test_mermaidForFile_emitsFlowchartAndOneBoxForThePath", () => {
    // Calls mermaidForFile with a path and empty source; expects a two-line flowchart with one box.
    const result = mermaidForFile("scripts/foo/main.ts", "");
    // Checks the exact string: box id replaces non-identifier characters in the path with underscores.
    assert.equal(result, '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\nB_scripts_foo_main_ts["scripts/foo/main.ts"]\nclassDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\nclassDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\nclassDef decision fill:#fff3bf,stroke:#f08c00,color:#000\nclassDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\nclassDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\nclassDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\nclass B_scripts_foo_main_ts fileRoot\n');
});

test("test_mermaidForFile_replacesEveryNonIdentifierCharInTheBoxId", () => {
    // A path with a dash, slashes, and dots becomes an id joined only by underscores.
    const result = mermaidForFile("a-b/c.d.ts", "");
    // Verify: dash, slash, and every dot become _; the label keeps the original path.
    assert.equal(result, '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\nB_a_b_c_d_ts["a-b/c.d.ts"]\nclassDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\nclassDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\nclassDef decision fill:#fff3bf,stroke:#f08c00,color:#000\nclassDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\nclassDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\nclassDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\nclass B_a_b_c_d_ts fileRoot\n');
});

test("test_writeAllDiagrams_writesOnlyForNonTestTsFiles", () => {
    // In a temp git repo with a.ts, a.test.ts, and tests/b.ts committed, only a.mmd is written.
    const repoRoot = mkdtempSync(join(tmpdir(), "mermaid-"));
    git(repoRoot, "init", "-q");
    git(repoRoot, "config", "user.email", "test@example.com");
    git(repoRoot, "config", "user.name", "Test");
    // Setup: commit a.ts, a.test.ts, and tests/b.ts.
    writeFileSync(join(repoRoot, "a.ts"), "");
    writeFileSync(join(repoRoot, "a.test.ts"), "");
    mkdirSync(join(repoRoot, "tests"), { recursive: true });
    writeFileSync(join(repoRoot, "tests", "b.ts"), "");
    git(repoRoot, "add", "-A");
    git(repoRoot, "commit", "-q", "-m", "seed");
    // Test action: run the scanner against the temp repo.
    writeAllDiagrams(repoRoot);
    // Verify: only a.mmd is written under .taskTools/diagrams.
    const diagramsDir = join(repoRoot, ".taskTools", "diagrams");
    assert.deepEqual(readdirSync(diagramsDir), ["a.mmd"]);
    // Verify: the excluded files produced no diagram and no tests subdirectory.
    assert.ok(!existsSync(join(diagramsDir, "a.test.mmd")));
    assert.ok(!existsSync(join(diagramsDir, "tests")));
    // Verify: a.mmd holds exactly what mermaidForFile emits for a.ts.
    assert.equal(readFileSync(join(diagramsDir, "a.mmd"), "utf8"), mermaidForFile("a.ts", ""));
    // Cleanup.
    rmSync(repoRoot, { recursive: true, force: true });
});

test("test_mermaidForFile_parsesFunctionNamesAndChainsCallStatements", () => {
    // Five functions: three have empty bodies; two chain their call statements in order.
    const source = 'function a() {}\nfunction b() {}\nfunction c() {}\nfunction multipleCalls() { a(); b(); c(); a(); }\nfunction singleCall() { a(); b(); }\n';
    const result = mermaidForFile("f.ts", source);
    // Verify: a, b, c get no top box; calls share a running number file-wide; functions chain calls in order.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_f_ts["f.ts"]\n' +
        'B_a1["a()"]\n' +
        'B_a2["a()"]\n' +
        'B_a3["a()"]\n' +
        'B_b1["b()"]\n' +
        'B_b2["b()"]\n' +
        'B_c["c()"]\n' +
        'B_multipleCalls["multipleCalls()"]\n' +
        'B_singleCall["singleCall()"]\n' +
        'B_multipleCalls --> B_a1 --> B_b1 --> B_c --> B_a2\n' +
        'B_singleCall --> B_a3 --> B_b2\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_f_ts fileRoot\n' +
        'class B_multipleCalls,B_singleCall funcDecl\n' +
        'class B_a1,B_a2,B_a3,B_b1,B_b2,B_c expression\n'
    );
});

test("test_mermaidForFile_labelsAClassMethodWithClassNameAndMethodName", () => {
    // Scenario: a class with method bar gets a top box labelled Foo::bar(), then statement boxes; step: one-method class.
    const source = 'class Foo {\n  bar() {\n    const a = 1;\n    const b = 2;\n  }\n}\n';
    const result = mermaidForFile("g.ts", source);
    // The method box id joins class and method names with an underscore; each statement chains from it.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_g_ts["g.ts"]\n' +
        'B_Foo_bar["Foo::bar()"]\n' +
        'B_a_equals_1["const a = 1"]\n' +
        'B_b_equals_2["const b = 2"]\n' +
        'B_Foo_bar --> B_a_equals_1 --> B_b_equals_2\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_g_ts fileRoot\n' +
        'class B_Foo_bar funcDecl\n' +
        'class B_a_equals_1,B_b_equals_2 expression\n'
    );
});
