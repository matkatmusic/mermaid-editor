# mermaid-editor

## Launch the server

```sh
bun install
bun run build
bun server.js
```

The terminal prints the address. Open it in your browser.

## Options

- `--port 4000`: use this port. With no `--port`, the server picks a free port.
- `--hostname 127.0.0.1`: listen on a different address. The default is `0.0.0.0`.
- `DIAGRAMS_DIR=/path/to/diagrams bun server.js`: read `.mmd` files from a different folder. The default is `../diagrams`.

Run `bun run build` again after you change a `.ts` file. The build makes `viewer.js`.

## Node names

The editor reads the start of each node name to know what the node is. Each kind needs one shape.

| Start of name | Kind | Shape | Example |
| --- | --- | --- | --- |
| `B_` | Static block: one step | `[]` | `B_SAY_HELLO["Say hello"]` |
| `Q_` | Decision: a question | `{}` | `Q_MOOD{"How do you feel?"}` |
| `Q_CHOICE_` | Choice: one answer to a question | `[]` | `Q_CHOICE_MOOD_GOOD["Good"]` |

- Name a choice `Q_CHOICE_<question>_<answer>`. `<question>` is the question name without `Q_`. The editor uses this to match each answer to its question.
- A `Q_` decision can be a choice of the decision before it. Connect them with an arrow, for example `Q_ABOUT --> Q_BROAD_INFORMATION`. The second decision shows as a choice button of the first. After you pick it, its own choices show as buttons.
- A `B_` block with a label like `doThing(x)` is a function call.
- The editor rejects any other name start. It also rejects round shapes like `([ ])`.
- New nodes get the names `B_NEW_1`, `Q_NEW_1`, and so on.

## Check a diagram

Run this command to check that a `.mmd` file follows the node-name rules above and is valid Mermaid:

```sh
bun /Users/matkatmusicllc/Programming/relationship-mermaid/mermaid-editor/check-diagram.ts <file.mmd>
```

- If the file is correct, the command prints `OK <file>` and exits with code 0.
- If the file has problems, the command prints one problem on each line and exits with code 1. A problem from Mermaid's own parser starts with `Mermaid: `.
- The command uses the same rules as the editor (`editor-graph-parse.ts`), so a file that passes also opens in the editor.
- The Mermaid check starts Google Chrome with no window, so each check takes a few seconds. Chrome must be at `/Applications/Google Chrome.app`.
- The command writes no files.
