// If/else diamond checks. Run alone: node --test tests/create-mermaid-if.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mermaidForFile } from "../scripts/create-mermaid/mermaid.ts";

test("test_mermaidForFile_parsesAnIfWithEarlyReturnIntoADiamondWithTwoChoices", () => {
    // Scenario: the load(path) example — an if with only a then-arm that returns, followed by two more statements.
    const source = 'function load(path: string) {\n  if (!exists(path)) {\n    return null;\n  }\n  const raw = read(path);\n  return parse(raw);\n}\n';
    const result = mermaidForFile("p.ts", source);
    // Verify: diamond and choice ids come from computeBaseId; the Y arm returns; the N arm (no else) falls through.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_p_ts["p.ts"]\n' +
        'B_load["load(path: string)"]\n' +
        'B_raw_equals_read_path["const raw = read(path)"]\n' +
        'B_return["return null"]\n' +
        'B_return_parse_raw["return parse(raw)"]\n' +
        'Q_CHOICE_not_exists_path_N["FALSE"]\n' +
        'Q_CHOICE_not_exists_path_Y["TRUE"]\n' +
        'Q_not_exists_path{"if( !exists(path) )"}\n' +
        'B_load --> Q_not_exists_path\n' +
        'Q_not_exists_path --> Q_CHOICE_not_exists_path_Y --> B_return\n' +
        'Q_not_exists_path --> Q_CHOICE_not_exists_path_N --> B_raw_equals_read_path --> B_return_parse_raw\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_p_ts fileRoot\n' +
        'class B_load funcDecl\n' +
        'class Q_not_exists_path decision\n' +
        'class B_raw_equals_read_path,B_return,B_return_parse_raw expression\n' +
        'class Q_CHOICE_not_exists_path_Y trueBranch\n' +
        'class Q_CHOICE_not_exists_path_N falseBranch\n'
    );
});

test("test_mermaidForFile_bothIfElseArmsRejoinAtTheStatementAfterTheIf", () => {
    // Scenario: an if/else where neither arm returns; both rejoin at one next-statement box, declared once, referenced twice.
    const source = 'function g(flag) {\n  if (flag) {\n    doA();\n  } else {\n    doB();\n  }\n  doNext();\n}\n';
    const result = mermaidForFile("r.ts", source);
    // Verify: doNext() is declared once; both Y-arm and N-arm chains end with "--> B_doNext"; bare identifier's opposite is "!(text)".
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_r_ts["r.ts"]\n' +
        'B_doA["doA()"]\n' +
        'B_doB["doB()"]\n' +
        'B_doNext["doNext()"]\n' +
        'B_g["g(flag)"]\n' +
        'Q_CHOICE_flag_N["FALSE"]\n' +
        'Q_CHOICE_flag_Y["TRUE"]\n' +
        'Q_flag{"if( flag )"}\n' +
        'B_g --> Q_flag\n' +
        'Q_flag --> Q_CHOICE_flag_Y --> B_doA --> B_doNext\n' +
        'Q_flag --> Q_CHOICE_flag_N --> B_doB --> B_doNext\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_r_ts fileRoot\n' +
        'class B_g funcDecl\n' +
        'class Q_flag decision\n' +
        'class B_doA,B_doB,B_doNext expression\n' +
        'class Q_CHOICE_flag_Y trueBranch\n' +
        'class Q_CHOICE_flag_N falseBranch\n'
    );
});

test("test_mermaidForFile_greaterThanConditionFlipsToLessThanOrEqualOnTheNoArm", () => {
    // Scenario: `if (count > 3)` with no else; verifies the id-from-condition rule and the operator-flip table entry for ">".
    const source = 'function f(count) {\n  if (count > 3) {\n    doThing();\n  }\n}\n';
    const result = mermaidForFile("q.ts", source);
    // Verify: the diamond id is Q_count_greater_than_3; the _N choice box is labelled "count <= 3".
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_q_ts["q.ts"]\n' +
        'B_doThing["doThing()"]\n' +
        'B_f["f(count)"]\n' +
        'Q_CHOICE_count_greater_than_3_N["FALSE"]\n' +
        'Q_CHOICE_count_greater_than_3_Y["TRUE"]\n' +
        'Q_count_greater_than_3{"if( count > 3 )"}\n' +
        'B_f --> Q_count_greater_than_3\n' +
        'Q_count_greater_than_3 --> Q_CHOICE_count_greater_than_3_Y --> B_doThing\n' +
        'Q_count_greater_than_3 --> Q_CHOICE_count_greater_than_3_N\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_q_ts fileRoot\n' +
        'class B_f funcDecl\n' +
        'class Q_count_greater_than_3 decision\n' +
        'class B_doThing expression\n' +
        'class Q_CHOICE_count_greater_than_3_Y trueBranch\n' +
        'class Q_CHOICE_count_greater_than_3_N falseBranch\n'
    );
});

test("test_mermaidForFile_nestedIfRejoinsInnerArmsBeforeOuterArmRejoinsSeparately", () => {
    // Scenario: nested ifs; the inner if's arms rejoin, then continue past outer if; the outer N-arm reaches same statement.
    const source = 'function f(x, y) {\n  if (x) {\n    if (y) {\n      a();\n    } else {\n      b();\n    }\n    c();\n  }\n  d();\n}\n';
    const result = mermaidForFile("s.ts", source);
    // Verify: Q_x, Q_y diamonds; Q_y's arms join at B_c then B_d; Q_x's N arm reaches B_d, bypassing B_c.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_s_ts["s.ts"]\n' +
        'B_a["a()"]\n' +
        'B_b["b()"]\n' +
        'B_c["c()"]\n' +
        'B_d["d()"]\n' +
        'B_f["f(x, y)"]\n' +
        'Q_CHOICE_x_N["FALSE"]\n' +
        'Q_CHOICE_x_Y["TRUE"]\n' +
        'Q_CHOICE_y_N["FALSE"]\n' +
        'Q_CHOICE_y_Y["TRUE"]\n' +
        'Q_x{"if( x )"}\n' +
        'Q_y{"if( y )"}\n' +
        'B_f --> Q_x\n' +
        'Q_x --> Q_CHOICE_x_Y --> Q_y\n' +
        'Q_y --> Q_CHOICE_y_Y --> B_a --> B_c\n' +
        'Q_y --> Q_CHOICE_y_N --> B_b --> B_c\n' +
        'B_c --> B_d\n' +
        'Q_x --> Q_CHOICE_x_N --> B_d\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_s_ts fileRoot\n' +
        'class B_f funcDecl\n' +
        'class Q_x,Q_y decision\n' +
        'class B_a,B_b,B_c,B_d expression\n' +
        'class Q_CHOICE_x_Y,Q_CHOICE_y_Y trueBranch\n' +
        'class Q_CHOICE_x_N,Q_CHOICE_y_N falseBranch\n'
    );
});
