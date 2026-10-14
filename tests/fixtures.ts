import { readFileSync } from "node:fs";
import { join } from "node:path";

export const EDITOR_FIXTURE_NAME = "say-something-or-let-it-go.mmd";
// Saves no longer write the retired typeColors/nodeTypes metadata, so the fixture must not carry them either.
export const editorFixtureSource = readFileSync(join(process.cwd(), "..", "diagrams", EDITOR_FIXTURE_NAME), "utf8")
  .replace(/,"typeColors":\{[^}]*\},"nodeTypes":\{[^}]*\}/, "");

export const SCROLL_FIXTURE_NAME = "accountability.mmd";
export const scrollFixtureSource = readFileSync(join(process.cwd(), "..", "diagrams", SCROLL_FIXTURE_NAME), "utf8");

export const SEARCH_FIXTURE = 'flowchart TD\n  B_START["Start"]\n  Q_FIRST{"First decision"}\n  Q_CHOICE_FIRST_YES["Yes"]\n  Q_CHOICE_FIRST_NO["No"]\n  B_MIDDLE["Middle"]\n  Q_SECOND{"Second decision"}\n  Q_CHOICE_SECOND_YES["Yes"]\n  Q_CHOICE_SECOND_NO["No"]\n  B_START --> Q_FIRST\n  Q_FIRST --> Q_CHOICE_FIRST_YES --> B_MIDDLE --> Q_SECOND\n  Q_FIRST --> Q_CHOICE_FIRST_NO\n  Q_SECOND --> Q_CHOICE_SECOND_YES\n  Q_SECOND --> Q_CHOICE_SECOND_NO';
