import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks, SERVER_PORT } from "./browser-harness.ts";
import { evaluate, sleep } from "./cdp.ts";
import { SCROLL_FIXTURE_NAME, scrollFixtureSource } from "./fixtures.ts";
import { clickNode, openEditorDrawer, outputScrollTop } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const FAR_NODE_ID = "B_SELF_CREATE_SYNTHETIC_IMPACT_STATEMENT";

async function selectedLineBounds() {
  // Measure the soft-wrapped selected line with a hidden copy of the textarea text.
  return evaluate(`JSON.stringify((() => {
    const style = getComputedStyle(codeBox);
    const mirror = document.createElement('div');
    for (const name of ['fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'tabSize', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth', 'boxSizing'])
      mirror.style[name] = style[name];
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.width = codeBox.clientWidth + 'px';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.overflowWrap = 'break-word';
    mirror.textContent = codeBox.value.slice(0, codeBox.selectionStart);
    const marker = document.createElement('span');
    marker.textContent = codeBox.value.slice(codeBox.selectionStart, codeBox.selectionEnd) || '.';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const top = marker.offsetTop;
    const bottom = top + marker.offsetHeight;
    mirror.remove();
    return { top, bottom, viewTop: codeBox.scrollTop, viewBottom: codeBox.scrollTop + codeBox.clientHeight };
  })())`).then(JSON.parse);
}

test("test_clicking_a_node_scrolls_the_source_to_its_declaration_only_when_the_drawer_is_open", async () => {
  // Scenario: a node click scrolls the source only when the drawer is open.
  await evaluate(`loadDiagram(${JSON.stringify(SCROLL_FIXTURE_NAME)})`);
  await sleep(500);
  assert.ok(await evaluate("codeBox.scrollHeight > codeBox.clientHeight"));

  // Step: with the drawer open, the selected line ends up in the visible area and nothing else scrolls.
  await evaluate("codeBox.scrollTop = 0; document.getElementById('output').scrollTop = 150");
  const outputBefore = await outputScrollTop();
  const pageBefore = await evaluate("document.scrollingElement.scrollTop");
  await clickNode(FAR_NODE_ID);
  const bounds = await selectedLineBounds();
  assert.ok(bounds.top >= bounds.viewTop && bounds.bottom <= bounds.viewBottom, JSON.stringify(bounds));
  assert.equal(await outputScrollTop(), outputBefore);
  assert.equal(await evaluate("document.scrollingElement.scrollTop"), pageBefore);

  // Step: with the drawer collapsed, the source does not scroll.
  await evaluate("document.getElementById('drawerToggle').click()");
  assert.ok(await evaluate("document.getElementById('drawer').classList.contains('closed')"));
  await evaluate("codeBox.scrollTop = 0");
  await clickNode(FAR_NODE_ID);
  assert.equal(await evaluate("codeBox.scrollTop"), 0);

  await fetch(`http://localhost:${SERVER_PORT}/api/diagrams/${SCROLL_FIXTURE_NAME}`, { method: "PUT", body: scrollFixtureSource });
});
