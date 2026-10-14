// Loop diamond checks. Run alone: node --test tests/create-mermaid-loops.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mermaidForFile } from "../scripts/create-mermaid/mermaid.ts";

test("test_mermaidForFile_forOfLoopBecomesADiamondWithABackEdge", () => {
    // Scenario: the sum(list) for-loop example from task 190 (without the while).  Step: call it with that function body.
    const source = 'function sum(list: number[]) {\n  let total = 0;\n  for (const x of list) {\n    total += x;\n  }\n  return total;\n}\n';
    const result = mermaidForFile("t.ts", source);
    // Verify: diamond id is "for_" plus computeBaseId; Y arm enters body, loops back; N arm exits after the loop.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_t_ts["t.ts"]\n' +
        'B_return_total["return total"]\n' +
        'B_sum["sum(list: number[])"]\n' +
        'B_total_equals_0["let total = 0"]\n' +
        'B_total_plus_equals_x["total += x"]\n' +
        'Q_CHOICE_for_x_of_list_N["i >= list.length"]\n' +
        'Q_CHOICE_for_x_of_list_Y["i < list.length; x = list[i];"]\n' +
        'Q_for_x_of_list{"for (const x of list)"}\n' +
        'B_sum --> B_total_equals_0 --> Q_for_x_of_list\n' +
        'Q_for_x_of_list --> Q_CHOICE_for_x_of_list_Y --> B_total_plus_equals_x --> Q_for_x_of_list\n' +
        'Q_for_x_of_list --> Q_CHOICE_for_x_of_list_N --> B_return_total\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_t_ts fileRoot\n' +
        'class B_sum funcDecl\n' +
        'class Q_for_x_of_list decision\n' +
        'class B_return_total,B_total_equals_0,B_total_plus_equals_x expression\n' +
        'class Q_CHOICE_for_x_of_list_Y trueBranch\n' +
        'class Q_CHOICE_for_x_of_list_N falseBranch\n'
    );
});

test("test_mermaidForFile_classicForConditionAndItsFlippedOppositeBecomeTheChoiceLabels", () => {
    // Scenario: classic `for (let i = 0; i < 3; i++)` with a one-statement body and nothing after it.
    const source = 'function count() {\n  for (let i = 0; i < 3; i++) {\n    log(i);\n  }\n}\n';
    const result = mermaidForFile("u.ts", source);
    // Verify: _Y labels the condition, _N its flipped opposite; the loop's only open path (_N) flushes at the end.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_u_ts["u.ts"]\n' +
        'B_count["count()"]\n' +
        'B_log_i["log(i)"]\n' +
        'Q_CHOICE_for_i_equals_0_i_less_than_3_i_N["i >= 3"]\n' +
        'Q_CHOICE_for_i_equals_0_i_less_than_3_i_Y["i < 3"]\n' +
        'Q_for_i_equals_0_i_less_than_3_i{"for (let i = 0; i < 3; i++)"}\n' +
        'B_count --> Q_for_i_equals_0_i_less_than_3_i\n' +
        'Q_for_i_equals_0_i_less_than_3_i --> Q_CHOICE_for_i_equals_0_i_less_than_3_i_Y --> B_log_i --> Q_for_i_equals_0_i_less_than_3_i\n' +
        'Q_for_i_equals_0_i_less_than_3_i --> Q_CHOICE_for_i_equals_0_i_less_than_3_i_N\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_u_ts fileRoot\n' +
        'class B_count funcDecl\n' +
        'class Q_for_i_equals_0_i_less_than_3_i decision\n' +
        'class B_log_i expression\n' +
        'class Q_CHOICE_for_i_equals_0_i_less_than_3_i_Y trueBranch\n' +
        'class Q_CHOICE_for_i_equals_0_i_less_than_3_i_N falseBranch\n'
    );
});

test("test_mermaidForFile_whileLoopBecomesADiamondWithABackEdge", () => {
    // Scenario: the full sum(list) example from task 190 - a for loop, then a while loop, then a return.
    const source = 'function sum(list: number[]) {\n  let total = 0;\n  for (const x of list) {\n    total += x;\n  }\n  while (total > 100) {\n    total = halve(total);\n  }\n  return total;\n}\n';
    const result = mermaidForFile("v.ts", source);
    // Verify: while id = "while_"+computeBaseId; _Y/_N = condition/flip; for's _N feeds while; body loops; while's _N exits to return.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_v_ts["v.ts"]\n' +
        'B_return_total["return total"]\n' +
        'B_sum["sum(list: number[])"]\n' +
        'B_total_equals_0["let total = 0"]\n' +
        'B_total_equals_halve_total["total = halve(total)"]\n' +
        'B_total_plus_equals_x["total += x"]\n' +
        'Q_CHOICE_for_x_of_list_N["i >= list.length"]\n' +
        'Q_CHOICE_for_x_of_list_Y["i < list.length; x = list[i];"]\n' +
        'Q_CHOICE_while_total_greater_than_100_N["total <= 100"]\n' +
        'Q_CHOICE_while_total_greater_than_100_Y["total > 100"]\n' +
        'Q_for_x_of_list{"for (const x of list)"}\n' +
        'Q_while_total_greater_than_100{"while (total > 100)"}\n' +
        'B_sum --> B_total_equals_0 --> Q_for_x_of_list\n' +
        'Q_for_x_of_list --> Q_CHOICE_for_x_of_list_Y --> B_total_plus_equals_x --> Q_for_x_of_list\n' +
        'Q_for_x_of_list --> Q_CHOICE_for_x_of_list_N --> Q_while_total_greater_than_100\n' +
        'Q_while_total_greater_than_100 --> Q_CHOICE_while_total_greater_than_100_Y --> B_total_equals_halve_total --> Q_while_total_greater_than_100\n' +
        'Q_while_total_greater_than_100 --> Q_CHOICE_while_total_greater_than_100_N --> B_return_total\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_v_ts fileRoot\n' +
        'class B_sum funcDecl\n' +
        'class Q_for_x_of_list,Q_while_total_greater_than_100 decision\n' +
        'class B_return_total,B_total_equals_0,B_total_equals_halve_total,B_total_plus_equals_x expression\n' +
        'class Q_CHOICE_for_x_of_list_Y,Q_CHOICE_while_total_greater_than_100_Y trueBranch\n' +
        'class Q_CHOICE_for_x_of_list_N,Q_CHOICE_while_total_greater_than_100_N falseBranch\n'
    );
});

test("test_mermaidForFile_doWhileLoopWalksTheBodyFirstThenLoopsBackOnTheCondition", () => {
    // Scenario: a do-while loop runs the body once, then loops back while the condition holds.
    const source = 'function sum(list: number[]) {\n  let total = 0;\n  do {\n    total = halve(total);\n  } while (total > 100);\n  return total;\n}\n';
    const result = mermaidForFile("w.ts", source);
    // Verify: the body chains before the diamond; Y loops back to the body; N falls through to the return.
    assert.equal(
        result,
        '%%{init: {"flowchart": {"wrappingWidth": 100000}}}%%\nflowchart TD\n' +
        'B_w_ts["w.ts"]\n' +
        'B_return_total["return total"]\n' +
        'B_sum["sum(list: number[])"]\n' +
        'B_total_equals_0["let total = 0"]\n' +
        'B_total_equals_halve_total["total = halve(total)"]\n' +
        'Q_CHOICE_while_total_greater_than_100_N["total <= 100"]\n' +
        'Q_CHOICE_while_total_greater_than_100_Y["total > 100"]\n' +
        'Q_while_total_greater_than_100{"while (total > 100)"}\n' +
        'B_sum --> B_total_equals_0 --> B_total_equals_halve_total --> Q_while_total_greater_than_100\n' +
        'Q_while_total_greater_than_100 --> Q_CHOICE_while_total_greater_than_100_Y --> B_total_equals_halve_total\n' +
        'Q_while_total_greater_than_100 --> Q_CHOICE_while_total_greater_than_100_N --> B_return_total\n' +
        'classDef fileRoot fill:#dee2e6,stroke:#495057,color:#000\n' +
        'classDef funcDecl fill:#e5dbff,stroke:#7048e8,color:#000\n' +
        'classDef decision fill:#fff3bf,stroke:#f08c00,color:#000\n' +
        'classDef expression fill:#d0ebff,stroke:#1c7ed6,color:#000\n' +
        'classDef trueBranch fill:#c3e6cb,stroke:#28a745,color:#000\n' +
        'classDef falseBranch fill:#f5c6cb,stroke:#dc3545,color:#000\n' +
        'class B_w_ts fileRoot\n' +
        'class B_sum funcDecl\n' +
        'class Q_while_total_greater_than_100 decision\n' +
        'class B_return_total,B_total_equals_0,B_total_equals_halve_total expression\n' +
        'class Q_CHOICE_while_total_greater_than_100_Y trueBranch\n' +
        'class Q_CHOICE_while_total_greater_than_100_N falseBranch\n'
    );
});
