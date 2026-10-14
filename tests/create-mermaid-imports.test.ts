// Import-path label checks. Run alone: node --test tests/create-mermaid-imports.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mermaidForFile } from "../scripts/create-mermaid/mermaid.ts";

test("test_mermaidForFile_addsRelativeImportPathAsSecondLabelLineForAConstAssignmentCall", () => {
    // Scenario: a const-assignment call to a relative import gets a second label line; a property-access call to global doesn't.
    const source = 'import { readTask } from "../shared/tasks.ts";\nfunction main() { const t = readTask(1); console.log(t); }\n';
    const result = mermaidForFile("j.ts", source);
    // Verify: readTask call box gains <br/>../shared/tasks.ts; console.log box gains no second line; import declaration produces no box.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_j_ts["j.ts"]\n' +
        'B_console_log_t["console.log(t)"]\n' +
        'B_main["main()"]\n' +
        'B_t_equals_readTask_1["const t = readTask(1)<br/>../shared/tasks.ts"]\n' +
        'B_main --> B_t_equals_readTask_1 --> B_console_log_t\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_j_ts fileRoot\n' +
        'class B_main funcDecl\n' +
        'class B_console_log_t,B_t_equals_readTask_1 expression\n'
    );
});

test("test_mermaidForFile_addsRelativeImportPathForABareCallStatement", () => {
    // Scenario: a bare call statement to a relative-imported function gets the import path as a second label line.
    const source = 'import { setup } from "./setup.ts";\nfunction g() { setup(); }\n';
    const result = mermaidForFile("k.ts", source);
    // Verify: the setup() call box gains <br/>./setup.ts.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_k_ts["k.ts"]\n' +
        'B_g["g()"]\n' +
        'B_setup["setup()<br/>./setup.ts"]\n' +
        'B_g --> B_setup\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_k_ts fileRoot\n' +
        'class B_g funcDecl\n' +
        'class B_setup expression\n'
    );
});

test("test_mermaidForFile_addsRelativeImportPathForAReturnCall", () => {
    // Scenario: a return statement whose expression is a relative-imported call gets the import path as a second label line.
    const source = 'import { pick } from "./pick.ts";\nfunction m() { return pick(); }\n';
    const result = mermaidForFile("l.ts", source);
    // Verify: the return pick() box gains <br/>./pick.ts.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_l_ts["l.ts"]\n' +
        'B_m["m()"]\n' +
        'B_return_pick["return pick()<br/>./pick.ts"]\n' +
        'B_m --> B_return_pick\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_l_ts fileRoot\n' +
        'class B_m funcDecl\n' +
        'class B_return_pick expression\n'
    );
});

test("test_mermaidForFile_addsRelativeImportPathForAnAwaitCall", () => {
    // Scenario: an await expression statement wrapping a relative-imported call gets the import path as a second label line.
    const source = 'import { flush } from "../io.ts";\nasync function n() { await flush(); }\n';
    const result = mermaidForFile("m.ts", source);
    // Verify: the await flush() box gains <br/>../io.ts.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_m_ts["m.ts"]\n' +
        'B_flush["await flush()<br/>../io.ts"]\n' +
        'B_n["n()"]\n' +
        'B_n --> B_flush\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_m_ts fileRoot\n' +
        'class B_n funcDecl\n' +
        'class B_flush expression\n'
    );
});

test("test_mermaidForFile_addsRelativeImportPathForADefaultImportCall", () => {
    // Scenario: a call to a default-imported function from relative specifier gets the import path as a second label line.
    const source = 'import run from "./run.ts";\nfunction q() { run(); }\n';
    const result = mermaidForFile("o.ts", source);
    // Verify: the run() call box gains <br/>./run.ts.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_o_ts["o.ts"]\n' +
        'B_q["q()"]\n' +
        'B_run["run()<br/>./run.ts"]\n' +
        'B_q --> B_run\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_o_ts fileRoot\n' +
        'class B_q funcDecl\n' +
        'class B_run expression\n'
    );
});

test("test_mermaidForFile_addsNoSecondLabelLineForANodeModuleImportCall", () => {
    // Scenario: a call to a function imported from a non-relative (node module) specifier gets no second label line.
    const source = 'import { execFileSync } from "node:child_process";\nfunction p() { execFileSync(); }\n';
    const result = mermaidForFile("n.ts", source);
    // Verify: the execFileSync() call box has no <br/> second line.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_n_ts["n.ts"]\n' +
        'B_execFileSync["execFileSync()"]\n' +
        'B_p["p()"]\n' +
        'B_p --> B_execFileSync\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_n_ts fileRoot\n' +
        'class B_p funcDecl\n' +
        'class B_execFileSync expression\n'
    );
});
