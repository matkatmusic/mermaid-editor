import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, send, waitMilliseconds } from "./cdp.ts";
import { dispatchNodeClick, openEditorDrawer, resetEditorFixture } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const PUZZLE_SOLVER_RULES = readFileSync(join(import.meta.dirname, "puzzle-solver-rules-current.fixture.mmd"), "utf8");
const CLICKED_QUESTION_ID = "Q_EVENT_REMOVAL_TIME_VS_GIT_HASH";
const CHOSEN_CHOICE_ID = "Q_CHOICE_EVENT_REMOVAL_TIME_VS_GIT_HASH_AFTER";
const NORMAL_WINDOW_HEIGHT = 1000;
const SHORT_WINDOW_HEIGHT = 800;

async function openPuzzleSolverRules() {
    await resetEditorFixture();
    await executeExpression(`showOpenedFile('/tmp/puzzle-solver-rules.mmd', ${JSON.stringify(PUZZLE_SOLVER_RULES)})`);
    await waitMilliseconds(1500);
}

async function clickQuestionThenChooseAfter() {
    await dispatchNodeClick(CLICKED_QUESTION_ID);
    await waitMilliseconds(1000);
    await executeExpression(`document.querySelector('#phoneDiagram button[data-choose="${CHOSEN_CHOICE_ID}"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await waitMilliseconds(1000);
}

// async function measureVisibleHistory() {
async function measureVisibleHistory(): Promise<{ historyHeight: number; historyFirstId?: string; hasClickedQuestion: boolean; hasChosenAnswer: boolean; clickedQuestionVisible: boolean; chosenAnswerVisible: boolean }> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const history = document.getElementById('phoneHistory');
        const historyRect = history.getBoundingClientRect();
        const historyIds = [...history.querySelectorAll('[data-node-id]')].map(el => el.dataset.nodeId);
        const clickedQuestion = history.querySelector('[data-node-id="${CLICKED_QUESTION_ID}"]');
        const chosenAnswer = history.querySelector('.phone-choice-chosen[data-node-id="${CHOSEN_CHOICE_ID}"]');
        const isInsideHistoryViewport = (el) => {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.top >= historyRect.top - 1 && r.bottom <= historyRect.bottom + 1;
        };
        return {
            historyHeight: Math.round(historyRect.height),
            historyFirstId: historyIds[0],
            hasClickedQuestion: !!clickedQuestion,
            hasChosenAnswer: !!chosenAnswer,
            clickedQuestionVisible: isInsideHistoryViewport(clickedQuestion),
            chosenAnswerVisible: isInsideHistoryViewport(chosenAnswer),
        };
    })())`));
}

test("test_clicking_a_deep_decision_then_choosing_keeps_the_path_to_it_visible_in_the_phone_history", async () => {
    // Step: open the puzzle diagram; click a decision deep in the tree.
    await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: NORMAL_WINDOW_HEIGHT, deviceScaleFactor: 1, mobile: false });
    await openPuzzleSolverRules();
    await dispatchNodeClick(CLICKED_QUESTION_ID);
    await waitMilliseconds(1000);
    // Step: the phone history starts at the start node and holds the path down to the clicked decision.
    // const idsAfterClick = await executeExpression("JSON.stringify([...document.querySelectorAll('#phoneHistory [data-node-id]')].map(el => el.dataset.nodeId))").then(JSON.parse);
    // const idsAfterClick = await executeExpression<string>("JSON.stringify([...document.querySelectorAll('#phoneHistory [data-node-id]')].map(el => el.dataset.nodeId))").then(JSON.parse);
    const idsAfterClick = await executeExpression<string>("JSON.stringify([...document.querySelectorAll('#phoneHistory [data-node-id]')].map(el => el.dataset.nodeId))").then((json) => JSON.parse(json) as string[]);
    assert.equal(idsAfterClick[0], "B_LAUNCH");
    // Step: choose "after"; the walk continues to the next open decision.
    await executeExpression(`document.querySelector('#phoneDiagram button[data-choose="${CHOSEN_CHOICE_ID}"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await waitMilliseconds(1000);
    // Step: the history still shows the clicked decision and the chosen answer, inside the part of the history the user can see.
    const measured = await measureVisibleHistory();
    assert.equal(measured.historyFirstId, "B_LAUNCH", JSON.stringify(measured));
    assert.ok(measured.hasClickedQuestion, JSON.stringify(measured));
    assert.ok(measured.hasChosenAnswer, JSON.stringify(measured));
    assert.ok(measured.historyHeight >= 150, JSON.stringify(measured));
    assert.ok(measured.clickedQuestionVisible, JSON.stringify(measured));
    assert.ok(measured.chosenAnswerVisible, JSON.stringify(measured));
});

test("test_clicking_a_decision_with_many_blocks_before_it_keeps_its_choices_inside_the_phone_screen", async () => {
    // Step: a short window; click a decision whose six lead-in blocks are shown above it (task 82 picture).
    await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: SHORT_WINDOW_HEIGHT, deviceScaleFactor: 1, mobile: false });
    await openPuzzleSolverRules();
    await dispatchNodeClick("Q_PUZZLE_ANY_EVENT_LEFT");
    await waitMilliseconds(1000);
    // const choiceGeometry = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const choiceGeometry: { screenBottom: number; choiceBottoms: number[] } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const phone = document.getElementById('phoneOutput').getBoundingClientRect();
        const screenBottom = phone.bottom - parseFloat(getComputedStyle(document.getElementById('phoneOutput')).borderBottomWidth);
        const choices = [...document.querySelectorAll('#phoneFooter .phone-choice')].map(el => el.getBoundingClientRect());
        return { screenBottom, choiceBottoms: choices.map(r => r.bottom) };
    })())`));
    await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: NORMAL_WINDOW_HEIGHT, deviceScaleFactor: 1, mobile: false });
    // Step: both choices end inside the phone screen without the user scrolling.
    assert.equal(choiceGeometry.choiceBottoms.length, 2, JSON.stringify(choiceGeometry));
    for (const choiceBottom of choiceGeometry.choiceBottoms)
        assert.ok(choiceBottom <= choiceGeometry.screenBottom, JSON.stringify(choiceGeometry));
});

test("test_clicking_a_deep_decision_in_a_short_window_keeps_the_path_visible_and_the_choices_inside_the_phone_screen", async () => {
    // Step: a short window; click the decision, then choose "after".
    await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: SHORT_WINDOW_HEIGHT, deviceScaleFactor: 1, mobile: false });
    await openPuzzleSolverRules();
    await clickQuestionThenChooseAfter();
    const measured = await measureVisibleHistory();
    // Step: every choice button of the open decision ends inside the phone screen (the phone border is 8px).
    // const choiceGeometry = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const choiceGeometry: { screenBottom: number; choiceBottoms: number[]; choiceTops: number[] } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const phone = document.getElementById('phoneOutput').getBoundingClientRect();
        const screenBottom = phone.bottom - parseFloat(getComputedStyle(document.getElementById('phoneOutput')).borderBottomWidth);
        const choices = [...document.querySelectorAll('#phoneFooter .phone-choice')].map(el => el.getBoundingClientRect());
        return { screenBottom, choiceBottoms: choices.map(r => r.bottom), choiceTops: choices.map(r => r.top) };
    })())`));
    await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: NORMAL_WINDOW_HEIGHT, deviceScaleFactor: 1, mobile: false });
    assert.ok(choiceGeometry.choiceBottoms.length >= 2, JSON.stringify(choiceGeometry));
    for (const choiceBottom of choiceGeometry.choiceBottoms)
        assert.ok(choiceBottom <= choiceGeometry.screenBottom, JSON.stringify(choiceGeometry));
    // Step: the history still shows the clicked decision and the chosen answer.
    assert.ok(measured.historyHeight >= 150, JSON.stringify(measured));
    assert.ok(measured.clickedQuestionVisible, JSON.stringify(measured));
    assert.ok(measured.chosenAnswerVisible, JSON.stringify(measured));
});
