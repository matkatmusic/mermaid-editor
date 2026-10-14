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
- A `B_` block with a label like `doThing(x)` is a function call.
- The editor rejects any other name start. It also rejects round shapes like `([ ])`.
- New nodes get the names `B_NEW_1`, `Q_NEW_1`, and so on.
