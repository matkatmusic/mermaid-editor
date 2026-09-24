import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("test_dom_exports_the_functions_only_toggle", () => {
  const source = readFileSync(join(import.meta.dirname, "dom.ts"), "utf8");
  assert.ok(source.includes("export const functionsOnlyToggle = document.getElementById('functionsOnlyToggle') as HTMLInputElement;"));
});
