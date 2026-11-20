import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const CLASS_LINE_BEFORE_DEFINITION = 'flowchart TD\n  classDef Asked fill:#453ad9,stroke:#000000\n  class B_LATE Asked\n  B_FIRST["first"]\n  B_LATE["late"]\n  B_FIRST --> B_LATE';

test("test_node_defined_after_its_class_line_still_gets_the_class_fill", async () => {
  // Scenario: the class line comes before the node definition; Mermaid alone drops the class in that order.
  // Step: put the editor into a known state, then load a diagram whose class line comes first.
  await resetEditorFixture();
  await setEditorSource(CLASS_LINE_BEFORE_DEFINITION);
  // Step: read the fill of the late node's rectangle in the main view.
  const fill = await executeExpression(`getComputedStyle(document.querySelector('#output [id*="flowchart-B_LATE-"] rect')).fill`);
  // Step: the fill is the class color, not the default Mermaid color.
  assert.equal(fill, "rgb(69, 58, 217)");
});
