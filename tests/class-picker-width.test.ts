import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, selectEditorNode, setEditorSource } from "./editor-helpers.ts";
import { SEARCH_FIXTURE } from "./fixtures.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const LONG_CLASS_NAME = "aVeryLongClassNameThatIsWiderThanTheClassPickerButton";

test("test_class_picker_menu_grows_to_fit_the_longest_class_name_and_keeps_every_swatch_full_size", async () => {
  await resetEditorFixture();
  // Step: a diagram with one class whose name is much wider than the button that shows the current class.
  await setEditorSource(`${SEARCH_FIXTURE}\n  classDef short fill:#cfc,stroke:#393\n  classDef ${LONG_CLASS_NAME} fill:#fcc,stroke:#933`);
  await selectEditorNode("B_MIDDLE");
  // Step: open the class picker menu.
  await executeExpression("document.getElementById('classPickerBtn').click()");
  await waitMilliseconds(200);
  const measurements = JSON.parse(await executeExpression(`JSON.stringify({
    buttonWidth: document.getElementById('classPickerBtn').getBoundingClientRect().width,
    listWidth: document.getElementById('classPickerList').getBoundingClientRect().width,
    swatchWidths: Array.from(document.querySelectorAll('#classPickerList .class-swatch')).map(swatch => swatch.getBoundingClientRect().width),
    rowsWithWrappedText: Array.from(document.querySelectorAll('#classPickerList .class-picker-row')).filter(row => row.scrollWidth > row.clientWidth).length,
    longRowTextHeight: document.querySelector('#classPickerList .class-picker-row[data-class-name="${LONG_CLASS_NAME}"] span:last-child').getBoundingClientRect().height,
    shortRowTextHeight: document.querySelector('#classPickerList .class-picker-row[data-class-name="short"] span:last-child').getBoundingClientRect().height,
  })`));
  // Step: the menu is wider than the button.
  assert.ok(measurements.listWidth > measurements.buttonWidth);
  // Step: every color preview keeps its full 14 pixel width.
  for (const swatchWidth of measurements.swatchWidths)
    assert.equal(swatchWidth, 14);
  // Step: the long name stays on one line, as tall as a short name.
  assert.equal(measurements.longRowTextHeight, measurements.shortRowTextHeight);
  assert.equal(measurements.rowsWithWrappedText, 0);
});
