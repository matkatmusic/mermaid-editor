import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "../../browser-harness.ts";
// import { executeExpression, waitMilliseconds } from "../../cdp.ts";
import { executeExpression } from "../../cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "../../editor-helpers.ts";
import { clickNodeWithMouse, KeyName, Modifier, pressKey } from "../../real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const THREE_BLOCKS = 'flowchart TD\n  B_A["A"]\n  B_B["B"]\n  B_C["C"]\n  B_A --> B_B\n  B_B --> B_C';

async function startMultiSelectTest() {
    await resetEditorFixture();
    await setEditorSource(THREE_BLOCKS);
    // await waitMilliseconds(500);
}

// The page sends only `exists` when the badge is missing.
type BadgeState = { exists: boolean; scrollTop: number; hidden: boolean; visible: boolean; text: string; left: number; top: number; offsetLeft: number; offsetTop: number };

// async function getBadgeState() {
async function getBadgeState(): Promise<BadgeState> {
    return JSON.parse(await executeExpression(`JSON.stringify((() => {
        const badge = document.getElementById('multiSelectBadge');
        if (!badge)
            return { exists: false };
        const rect = badge.getBoundingClientRect();
        const outputRect = document.getElementById('output').getBoundingClientRect();
        return { exists: true, scrollTop: document.getElementById('output').scrollTop, hidden: badge.hidden, visible: rect.width > 0 && rect.height > 0, text: badge.textContent, left: rect.left, top: rect.top, offsetLeft: rect.left - outputRect.left, offsetTop: rect.top - outputRect.top };
    })())`));
}

test("test_badge_shows_the_count_while_two_nodes_are_selected", async () => {
    // Scenario: plain click B_A, Cmd-click B_B.
    await startMultiSelectTest();
    await clickNodeWithMouse("B_A");
    await clickNodeWithMouse("B_B", Modifier.Meta);
    const badge = await getBadgeState();
    assert.equal(badge.visible, true);
    assert.equal(badge.text, "selected: 2 nodes");
});

test("test_badge_count_follows_a_third_selected_node", async () => {
    await startMultiSelectTest();
    await clickNodeWithMouse("B_A");
    await clickNodeWithMouse("B_B", Modifier.Meta);
    await clickNodeWithMouse("B_C", Modifier.Meta);
    assert.equal((await getBadgeState()).text, "selected: 3 nodes");
});

test("test_badge_is_hidden_while_one_node_is_selected", async () => {
    await startMultiSelectTest();
    await clickNodeWithMouse("B_A");
    const badge = await getBadgeState();
    assert.equal(badge.exists, true);
    assert.equal(badge.visible, false);
});

test("test_badge_is_hidden_while_no_node_is_selected", async () => {
    await startMultiSelectTest();
    const badge = await getBadgeState();
    assert.equal(badge.exists, true);
    assert.equal(badge.visible, false);
});

test("test_badge_goes_away_when_cmd_click_leaves_one_node", async () => {
    await startMultiSelectTest();
    await clickNodeWithMouse("B_A");
    await clickNodeWithMouse("B_B", Modifier.Meta);
    await clickNodeWithMouse("B_B", Modifier.Meta);
    assert.equal((await getBadgeState()).visible, false);
});

test("test_badge_goes_away_on_escape", async () => {
    await startMultiSelectTest();
    await clickNodeWithMouse("B_A");
    await clickNodeWithMouse("B_B", Modifier.Meta);
    await pressKey(KeyName.Escape);
    assert.equal((await getBadgeState()).visible, false);
});

for (const drawerState of ["open", "closed"]) {
    test(`test_badge_sits_in_the_upper_left_corner_of_the_diagram_viewer_and_stays_while_the_diagram_scrolls_with_the_drawer_${drawerState}`, async () => {
        await startMultiSelectTest();
        const isClosed = await executeExpression("document.getElementById('drawer').classList.contains('closed')");
        if (drawerState === "closed" && !isClosed)
            await executeExpression("document.getElementById('drawerToggle').click()");
        if (drawerState === "open" && isClosed)
            await executeExpression("document.getElementById('drawerToggle').click()");
        // await waitMilliseconds(300);
        await clickNodeWithMouse("B_A");
        await clickNodeWithMouse("B_B", Modifier.Meta);
        const before = await getBadgeState();
        await executeExpression("(() => { const output = document.getElementById('output'); output.scrollTop += 150; output.scrollLeft += 150; })()");
        // await waitMilliseconds(200);
        const after = await getBadgeState();
        console.log(`MEASURED drawer ${drawerState}: ${JSON.stringify({ before, after })}`);
        assert.ok(before.offsetLeft >= 0 && before.offsetLeft <= 24, `offsetLeft ${before.offsetLeft}px`);
        assert.ok(before.offsetTop >= 0 && before.offsetTop <= 24, `offsetTop ${before.offsetTop}px`);
        assert.ok(after.scrollTop > before.scrollTop, `scrollTop ${before.scrollTop} -> ${after.scrollTop}`);
        assert.equal(after.offsetLeft, before.offsetLeft);
        assert.equal(after.offsetTop, before.offsetTop);
    });
}

test("test_badge_has_the_highest_z_index_on_the_page", async () => {
    await startMultiSelectTest();
    await clickNodeWithMouse("B_A");
    await clickNodeWithMouse("B_B", Modifier.Meta);
    // const zIndexes = JSON.parse(await executeExpression(`JSON.stringify((() => {
    const zIndexes: { badge: number; highestOther: number; named: Record<string, number> } = JSON.parse(await executeExpression(`JSON.stringify((() => {
        const read = (element) => Number.parseInt(getComputedStyle(element).zIndex, 10);
        const others = [...document.querySelectorAll('body *')].filter((element) => element.id !== 'multiSelectBadge' && !Number.isNaN(read(element)));
        const highestOther = Math.max(...others.map(read));
        const named = Object.fromEntries(['nodeInspector', 'viewportMenu', 'fileMenuItems', 'classPickerList'].map((id) => [id, read(document.getElementById(id))]));
        return { badge: read(document.getElementById('multiSelectBadge')), highestOther, named };
    })())`));
    console.log(`MEASURED z-index: ${JSON.stringify(zIndexes)}`);
    assert.ok(zIndexes.badge > zIndexes.highestOther, `badge ${zIndexes.badge}, highest other ${zIndexes.highestOther}`);
    assert.ok(zIndexes.badge > zIndexes.named.viewportMenu);
});
