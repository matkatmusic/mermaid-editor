import { test } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_FIXTURE_NAME, SCROLL_FIXTURE_NAME, SEARCH_FIXTURE, editorFixtureSource, scrollFixtureSource } from "./fixtures.ts";

test("test_fixtures_load_the_named_diagrams_as_flowcharts", () => {
  assert.ok(EDITOR_FIXTURE_NAME.endsWith(".mmd"));
  assert.ok(SCROLL_FIXTURE_NAME.endsWith(".mmd"));
  assert.ok(editorFixtureSource.includes("flowchart"));
  assert.ok(scrollFixtureSource.startsWith("flowchart TD"));
});

test("test_editor_fixture_drops_the_retired_type_metadata", () => {
  assert.ok(!editorFixtureSource.includes('"typeColors"'));
  assert.ok(!editorFixtureSource.includes('"nodeTypes"'));
});

test("test_search_fixture_declares_both_decisions", () => {
  assert.ok(SEARCH_FIXTURE.includes('Q_FIRST{"First decision"}'));
  assert.ok(SEARCH_FIXTURE.includes('Q_SECOND{"Second decision"}'));
});
