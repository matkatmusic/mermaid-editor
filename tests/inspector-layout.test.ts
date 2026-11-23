import { test } from "node:test";
import assert from "node:assert/strict";
import { registerBrowserHooks } from "./browser-harness.ts";
import { executeExpression, waitMilliseconds } from "./cdp.ts";
import { openEditorDrawer, resetEditorFixture, setEditorSource } from "./editor-helpers.ts";
import { clickNodeWithMouse } from "./real-input.ts";

registerBrowserHooks(import.meta.url, openEditorDrawer);

const SOURCE = ["flowchart TD", '  B_START["Start"]', '  Q_ASK{"Ask?"}', '  Q_CHOICE_ASK_YES["Yes"]', '  B_END["End"]', "  B_START --> Q_ASK", "  Q_ASK --> Q_CHOICE_ASK_YES --> B_END"].join("\n");

async function measureInspector() {
  return executeExpression(`JSON.stringify((() => {
    const box = (element) => { const rect = element.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height }; };
    const byId = (id) => box(document.getElementById(id));
    const fontSize = (element) => parseFloat(getComputedStyle(element).fontSize);
    const nodeTextLabel = document.getElementById('nodeTextInput').closest('label').querySelector('span');
    return {
      nodeTextLabelFont: fontSize(nodeTextLabel),
      kindLabelFont: fontSize(document.querySelector('#nodeKindRow label')),
      parentFont: fontSize(document.getElementById('nodeParentLabel')),
      kindRow: byId('nodeKindRow'), nameInput: byId('nodeNameInput'), nameCheck: byId('nodeNameCheck'),
      textInput: byId('nodeTextInput'), notesInput: byId('nodeNotesInput'), textHint: byId('nodeTextHint'), notesHint: byId('nodeNotesHint'),
      classPicker: byId('classPickerBtn'), destination: byId('destinationSelect'),
      firstAction: box(document.querySelector('#nodeInspectorActions button')),
    };
  })())`).then(JSON.parse);
}

async function selectChoiceAndMeasure() {
  await resetEditorFixture();
  await setEditorSource(SOURCE);
  await waitMilliseconds(500);
  await clickNodeWithMouse("Q_CHOICE_ASK_YES");
  await waitMilliseconds(300);
  return measureInspector();
}

for (const drawerState of ["open", "closed"]) {
  test(`test_inspector_rows_run_name_then_text_and_notes_then_class_and_destination_then_buttons_with_the_drawer_${drawerState}`, async () => {
    await resetEditorFixture();
    const isClosed = await executeExpression("document.getElementById('drawer').classList.contains('closed')");
    if (drawerState === "closed")
      await executeExpression("document.getElementById('drawer').classList.contains('closed') || document.getElementById('drawerToggle').click()");
    else if (isClosed)
      await executeExpression("document.getElementById('drawerToggle').click()");
    await waitMilliseconds(300);
    const measured = await selectChoiceAndMeasure();
    console.log(`MEASURED drawer ${drawerState}: ${JSON.stringify(measured)}`);
    // The type row and the Node Name box use the same font as the other labels.
    assert.equal(measured.kindLabelFont, measured.nodeTextLabelFont);
    assert.equal(measured.parentFont, measured.nodeTextLabelFont);
    // Row 1 (type row, Node Name box, checker line) ends above row 2.
    assert.ok(measured.nameCheck.bottom <= measured.textInput.top + 1, `row 1 bottom ${measured.nameCheck.bottom}px, row 2 top ${measured.textInput.top}px`);
    assert.ok(measured.kindRow.top < measured.nameInput.top);
    // Row 2: Node text on the left, Notes on the right, same top and same height.
    assert.ok(measured.textInput.right <= measured.notesInput.left, `text right ${measured.textInput.right}px, notes left ${measured.notesInput.left}px`);
    assert.ok(Math.abs(measured.textInput.top - measured.notesInput.top) <= 2);
    assert.ok(Math.abs(measured.textInput.height - measured.notesInput.height) <= 2);
    assert.ok(measured.textInput.height >= 40, `text box ${measured.textInput.height}px is two lines high`);
    // Row 3: Class picker and Destination picker side by side, below row 2 and its helper text.
    const row2Bottom = Math.max(measured.textHint.bottom, measured.notesHint.bottom);
    assert.ok(row2Bottom <= measured.classPicker.top + 1, `row 2 bottom ${row2Bottom}px, row 3 top ${measured.classPicker.top}px`);
    assert.ok(measured.classPicker.right <= measured.destination.left);
    assert.ok(Math.abs(measured.classPicker.top - measured.destination.top) <= 12);
    // Row 4: the buttons are below row 3.
    const row3Bottom = Math.max(measured.classPicker.bottom, measured.destination.bottom);
    assert.ok(row3Bottom <= measured.firstAction.top + 1, `row 3 bottom ${row3Bottom}px, row 4 top ${measured.firstAction.top}px`);
  });
}

async function selectNodeAndMeasureKindRow(id: string) {
  await resetEditorFixture();
  await setEditorSource(SOURCE);
  await waitMilliseconds(500);
  await clickNodeWithMouse(id);
  await waitMilliseconds(300);
  return executeExpression(`JSON.stringify((() => {
    const box = (element) => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }; };
    const labelOf = (checkboxId) => box(document.getElementById(checkboxId).closest('label'));
    const items = {
      staticLabel: labelOf('nodeKindStatic'), decisionLabel: labelOf('nodeKindQuestion'), choiceLabel: labelOf('nodeKindChoice'),
      shapeSwitchLabel: box(document.getElementById('decisionShapeRow')),
    };
    const shapeSwitchShown = !document.getElementById('decisionShapeRow').hidden;
    const alignButtons = [...document.querySelectorAll('#nodeAlignRow button')].map(box);
    return { items, shapeSwitchShown, alignButtons, inspector: box(document.getElementById('nodeInspector')) };
  })())`).then(JSON.parse);
}

type ItemBox = { left: number; right: number; top: number; bottom: number };

function boxesIntersect(first: ItemBox, second: ItemBox) {
  return first.left < second.right && second.left < first.right && first.top < second.bottom && second.top < first.bottom;
}

for (const [kindName, nodeId] of [["static", "B_START"], ["decision", "Q_ASK"], ["choice", "Q_CHOICE_ASK_YES"]]) {
  test(`test_the_six_align_buttons_sit_right_of_the_choice_checkbox_on_one_line_without_overlap_for_a_${kindName}_block`, async () => {
    const measured = await selectNodeAndMeasureKindRow(nodeId);
    console.log(`MEASURED ${kindName}: ${JSON.stringify(measured)}`);
    assert.equal(measured.alignButtons.length, 6);
    // The first align button is right of the Choice checkbox and on its line.
    const firstButton = measured.alignButtons[0];
    assert.ok(firstButton.left >= measured.items.choiceLabel.right, `first button left ${firstButton.left}px, Choice right ${measured.items.choiceLabel.right}px`);
    const choiceCentre = (measured.items.choiceLabel.top + measured.items.choiceLabel.bottom) / 2;
    for (const button of measured.alignButtons)
      assert.ok(Math.abs((button.top + button.bottom) / 2 - choiceCentre) <= 4, `button centre ${(button.top + button.bottom) / 2}px, Choice centre ${choiceCentre}px`);
    // The shape switch is shown only for a Decision block.
    assert.equal(measured.shapeSwitchShown, kindName === "decision");
    // No two items overlap, and every item is inside the inspector box.
    const shownItems = Object.entries(measured.items).filter(([name]) => name !== "shapeSwitchLabel" || measured.shapeSwitchShown);
    const everyBox = [...shownItems.map(([name, itemBox]) => ({ name, itemBox })), ...measured.alignButtons.map((itemBox: ItemBox, index: number) => ({ name: `alignButton${index}`, itemBox }))];
    for (const [firstIndex, first] of everyBox.entries()) {
      assert.ok(first.itemBox.left >= measured.inspector.left && first.itemBox.right <= measured.inspector.right, `${first.name} is outside the inspector`);
      assert.ok(first.itemBox.top >= measured.inspector.top && first.itemBox.bottom <= measured.inspector.bottom, `${first.name} is outside the inspector`);
      for (const second of everyBox.slice(firstIndex + 1))
        assert.ok(!boxesIntersect(first.itemBox, second.itemBox), `${first.name} overlaps ${second.name}`);
    }
  });
}
