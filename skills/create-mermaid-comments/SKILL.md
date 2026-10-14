---
name: create-mermaid-comments
description: add a `// %% <short phrase>` comment above every statement that /create-mermaid turns into a diagram box, so the diagram can show plain-language node text instead of code. Takes optional file paths; with none, covers every file /create-mermaid covers.
allowed-tools: Read, Edit, Bash(git *)
---

# create-mermaid-comments

Write a short plain-language label above each statement that becomes a box in the /create-mermaid diagram.

## Files

- With arguments: the files named in `$ARGUMENTS`.
- With no arguments: `git ls-files '*.ts'`, minus `*.test.ts` and `tests/`. This is the same file set as /create-mermaid.

## Comment format

`// %% <label>` on its own line, directly above the statement, at the statement's indent. A bare `%%` line is not valid TypeScript, so the `//` is required.

## Which statements get a label

One label per box that /create-mermaid draws (see `walkStatements` in `scripts/create-mermaid/mermaid.ts`):

- Every function declaration, `const name = (...) => ...` arrow function, and class method: label goes above the declaration.
- Every `if`, `for`, `for...of`, `for...in`, `while`, `do...while`: label goes above the keyword. Phrase it as a question: `// %% was a cell clicked?`
- Every other statement directly inside a function body, an `if`/`else` branch, or a loop body.
- Top-level statements that are not imports or functions.

No label for: import lines, and statements inside a callback passed as an argument (inside `.map(() => { ... })`, for example). The whole call is one box, so label the call.

## Label text

- 2 to 6 words, lower case, starts with a verb (or is a question, for decisions).
- Say what the step does for the program, not how the code does it.
- No function names, variable names, or code symbols.
- Read top to bottom, the labels tell the story of the function.

```ts
// %% handle a click on the grid
function onGridClick(event: MouseEvent) {
  // %% find which cell was clicked
  const cell = cellAt(event.clientX, event.clientY);
  // %% did the click miss every cell?
  if (cell === null) {
    // %% ignore the click
    return;
  }
  // %% run the cell's callback
  const result = cell.callback();
  // %% turn the result into html
  const html = renderResult(result);
  // %% show the html on the page
  output.innerHTML = html;
}
```

## Rules

- Change only comment lines. Do not change code.
- A statement that already has a `// %%` line: keep it if it is accurate, fix it if it is not. Never add a second one.
- Keep existing `//` comments. Put the `// %%` line between them and the statement.

## Check

Run `git diff -U0 -- <files>`. Every added line must be a `// %%` line. Every removed line must be an old `// %%` line. Undo anything else.
