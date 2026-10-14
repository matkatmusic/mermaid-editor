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
