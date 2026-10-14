import { execFileSync } from "node:child_process";
import { join } from "node:path";

const argumentFiles = process.argv.slice(2);
const trackedFiles: string[] = [];
const tracked = execFileSync("git", ["ls-files", "*.ts"], { encoding: "utf8" });
for (const relativePath of tracked.split("\n")) {
  if (relativePath.length === 0) {
    continue;
  }
  if (relativePath.endsWith(".test.ts")) {
    continue;
  }
  if (relativePath.startsWith("tests/")) {
    continue;
  }
  trackedFiles.push(relativePath);
}
const files = argumentFiles.length > 0 ? argumentFiles : trackedFiles;
const mermaidScriptPath = join(import.meta.dirname, "..", "create-mermaid", "mermaid.ts");

console.log(`# create-mermaid-comments

Write a short plain-language label above each statement that becomes a box in the /create-mermaid diagram.

## Files

${files.map((file) => `- ${file}`).join("\n")}

## Comment format

\`// %% <label>\` on its own line, directly above the statement, at the statement's indent. A bare \`%%\` line is not valid TypeScript, so the \`//\` is required.

## Which statements get a label

One label per box that /create-mermaid draws (see \`walkStatements\` in \`${mermaidScriptPath}\`):

- Every function declaration, \`const name = (...) => ...\` arrow function, and class method: label goes above the declaration.
- Every \`if\`, \`for\`, \`for...of\`, \`for...in\`, \`while\`, \`do...while\`: label goes above the keyword. Phrase it as a question: \`// %% was a cell clicked?\`
- Every other statement directly inside a function body, an \`if\`/\`else\` branch, or a loop body.
- Top-level statements that are not imports or functions.

No label for: import lines, and statements inside a callback passed as an argument (inside \`.map(() => { ... })\`, for example). The whole call is one box, so label the call.

## Label text

- 2 to 6 words, lower case, starts with a verb (or is a question, for decisions).
- Say what the step does for the program, not how the code does it.
- No function names, variable names, or code symbols.
- Read top to bottom, the labels tell the story of the function.

\`\`\`ts
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
\`\`\`

## Rules

- Change only comment lines. Do not change code.
- A statement that already has a \`// %%\` line: keep it if it is accurate, fix it if it is not. Never add a second one.
- Keep existing \`//\` comments. Put the \`// %%\` line between them and the statement.

## Check

Run \`git diff -U0 -- ${files.join(" ")}\`. Every added line must be a \`// %%\` line. Every removed line must be an old \`// %%\` line. Undo anything else.`);
