# mermaid-editor

## Launch the server

```sh
bun install
bun run build
bun server.js
```

The terminal prints the address. Open it in your browser.

To work on the editor code, run `bun run dev --port 4000` instead. It builds `viewer.js` and starts the server in one terminal. See "Work without restarts".

## Options

- `--port 4000`: use this port. With no `--port`, the server picks a free port.
- `--hostname 127.0.0.1`: listen on a different address. The default is `0.0.0.0`.
- `DIAGRAMS_DIR=/path/to/diagrams bun server.js`: read `.mmd` files from a different folder. The default is `../diagrams`.

Run `bun run build` again after you change a `.ts` file. The build makes `viewer.js`.

## Work without restarts

Run this command to skip restarting the server after a code change:

```sh
bun run dev --port 3000
```

- It builds `viewer.js` again when a `.ts` file for the page changes. Reload the page to see the change.
- It restarts the server when `server.js` changes.
- `--port 3000` keeps the same address after each restart. With no `--port`, the server picks a free port.
- When you stop the command, both parts stop together.

You can also run the two parts yourself, each in its own terminal:

```sh
bun --watch server.js --port 3000
bun build viewer.ts --outfile viewer.js --watch
```

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
- Write each node on its own line, for example `B_SAY_HELLO["Say hello"]`. Do not write the shape inside an arrow line.
- A `B_` block can lead to only one node.
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
- The command changes no diagram file. It makes a temporary Chrome folder and deletes it at the end.

## Features

### Opening and saving files

- **File menu:** click **File** at the top left. The menu holds **New**, **Save**, **Open file...**, **Reset**, **Classes...**, and **Diagrams**. The menu closes after you pick an item.
- **Diagrams:** open **Diagrams** in the File menu and pick a `.mmd` file from the diagrams folder.
- **New:** starts a blank diagram with one block, `B_NEW`. The source editor opens. The diagram has no file yet: click **Save** once before you use the node inspector.
- **Open file...:** shows a macOS file window. Pick any `.mmd` file on the computer. The window works on macOS only.
- **Save:** writes the diagram. A diagram from the Diagrams list goes back to the diagrams folder. A file from **Open file...** goes back to its own place. A new diagram asks the browser for a file name.
- **Saves at once:** a change made with the node inspector, the right-click menu, Undo, Redo, or the Classes window saves the file at once. Text you type in the source editor is not saved until you click **Save**.
- **Open again after a refresh:** the server remembers the last file you opened, also after a restart. The page opens it again.
- **Saved view:** the file keeps the selected node, the zoom, and the scroll place in a block of comment lines at its end. Do not edit that block. A click on a node or any save writes it. The next time the file opens, the editor selects that node, sets that zoom, and scrolls to that place. Scrolling alone does not write the block.
- **File name:** the header shows the file name and a short status, for example `Saved accountability.mmd`.

### Live reload from disk

- **Diagrams and opened files:** the server watches the open file. When another program changes it, the page loads the new text.
- **No unsaved edits:** the page loads the new text with no question.
- **Unsaved edits in the source editor:** a box asks: "This file changed on disk. OK loads the disk version. Cancel keeps your unsaved edits." Click **OK** to load the disk text. Click **Cancel** to keep your text.
- **Same text twice:** if you click **Cancel**, the page does not ask again for the same disk text.
- **Undo history:** after a load from disk, Undo starts again from the new text.

### The diagram view

- **Select a node:** click it. The node inspector opens below the diagram. The source editor marks the node's line. The phone view on the right changes to show that node's place. Press **Escape** to clear the selection.
- **Edit the node text fast:** double-click a node. The text in the **Node text** box becomes selected, so you can type the new text.
- **Connect two nodes:** hold Shift and click node A. Then hold Shift and click node B. The editor adds the line `A --> B`. A click without Shift, or a click on empty space, cancels the first pick. A second Shift-click on the same node does nothing.
- **Right-click menu:** right-click anywhere in the diagram. A menu opens at the pointer with **Add Decision Block** and **Add Static Block**. The new block has no arrows. **Add Decision Block** also adds **Yes** and **No** choices. The new node is selected and its text is selected, so you can type at once. Press **Escape** or click elsewhere to close the menu.
- **Zoom:** click **+** or **−** to change the zoom by 10 percent. Click **100%** to reset. The number beside the buttons shows the zoom. The file keeps the zoom.
- **Dark mode:** the **Dark mode** box at the top switches the colors. It is on at the start.
- **Decisions:** click the left arrow or the right arrow after **Decisions:** to select and center the previous or next question. The counter shows, for example, `3 / 24`.
- **Functions only:** tick **Functions only** to show only the blocks that are function calls, like `doThing(x)`, and the calls between them.
- **Notes:** a node that has a note shows a small dot. The dot color is the opposite of the node color, so it stays easy to see.
- **Source editor:** click the three-line button between the source editor and the diagram to show or hide the source editor. Type in it to change the diagram at once. A problem shows in the box under the text. The numbers on the left are line numbers.

### The node inspector

The node inspector shows under the diagram when a node is selected. Its title says what kind of node it is.

- **Node text:** type the new text. **Enter**, **Tab**, or a click away writes it.
- **Class:** see "Classes" below.
- **Notes:** type a note about the node. The note is saved as a line `%% ==note==: ...` above the node in the file. A click away writes it.
- **Destination:** blocks and choices have this list. It sets the one node that this node leads to. Pick **Terminal** for none, **New static block**, **New Decision block**, or any other node. The arrows that lead into this node stay.
- **Walk back:** selects the node that leads to this node. If several nodes lead to it, a window asks which one.
- **Remove:** removes the node. For a block, the nodes before it are joined to the node after it. For a choice, its arrows go too. A question with no choices goes at once.
- **Remove a question with choices:** **Remove** shows three buttons. Click **Next replacement path** to pick which choice carries on. Click **Confirm removal** to remove the question and its choices. Click **Cancel removal** to stop.

These buttons change with the node kind.

| Button | On | What it does |
| --- | --- | --- |
| **Add choice** | question | Adds a new choice, "New choice", and selects it. |
| **Remove choices** | question | Removes every choice of the question and its arrows. |
| **add Decision block after** | block, choice | Adds a new decision after the node. The node's old next node follows the new **Yes** choice. |
| **Insert decision block after** | block, choice | The same as **add Decision block after**. |
| **Insert static block after** | block, choice | Adds a new block between the node and its old next node. |
| **add static block after** | choice | Adds a new block as the next node. The old arrow goes. |
| **insert static block before** | question, block | Adds a new block between the node and the nodes that lead to it. |
| **insert Decision & leading choice before** | question, block | Adds a new decision with one choice between the node and the nodes that lead to it. The choice leads to the node. |

- After a button adds a new node, the new node is selected and its text is selected. **Insert static block after**, **add Decision block after**, and **insert Decision & leading choice before** also scroll the new block to the middle of the diagram.

### Undo and redo

- Click the undo button (the left curved arrow, "Undo edit") or the redo button (the right curved arrow, "Redo edit") at the top.
- Each change from the node inspector, the right-click menu, or the Classes window is one step.
- Typing in the source editor starts the history again from that text.
- There are no keyboard keys for undo and redo.

### Search

- Type in **Search nodes** at the top. The editor matches the node name or the node text. Capital letters do not matter.
- Each key you type searches again. The first match is selected and moved into view.
- The counter shows the match number, for example `1 / 3`. After an edit, the count updates.
- With two or more matches, click the left angle or the right angle to go to the previous or next match. The list wraps around.
- Click the **×** to clear the search.

### Classes

A class gives nodes a fill color and a stroke color. The file keeps classes as Mermaid `classDef` lines and `class` lines.

- **Class picker:** in the node inspector, click the **Class:** button. The menu shows every class with its colors. Pick a class to set it on the node. Pick **(none)** to remove the class. Pick **new...** to make a class and set it on the node. The menu is as wide as the longest class name.
- **Classes...:** in the File menu, opens a window with one row for each class. Each row has a fill color box, a stroke color box, a name box, and **Delete**. Change a color or the name to update the class at once. **Delete** comments out the class line in the file. **New...** opens the New class window. **Close** closes the window.
- **New class window:** type a **Name**. Pick **Fill** and **Stroke** colors. Click **Create**. The name must not be empty and must not be taken. Click **Cancel** to stop. A color box opens the color picker only when you click the color box itself.

### The phone view and paths

The phone frame on the right shows the diagram one step at a time, like a person who follows the diagram.

- **Walk the diagram:** the frame shows the start. Click a choice button to answer a question. The next steps show. Past answers are dimmed. A question that has only one choice is answered for you.
- **Change an answer:** click a dimmed choice that has the return arrow to switch to that answer.
- **Undo, Reset decisions:** after the first answer, **Undo** takes back the last answer. **Reset decisions** clears all answers. **Reset** in the File menu clears the answers too.
- **Write path:** after the first answer, click **Write path**. The editor saves the path you chose as a new file named `<name>-path-<N>.mmd`. N is one more than the highest number already used. A diagram from the Diagrams list writes the file into the diagrams folder. A file from **Open file...** asks you once to pick a folder in the browser.
- **Export all paths:** click **Export all paths** at the top. The editor writes one file for every full path through the diagram, with the same names. The status shows `Writing 2/9 paths`. While it runs, the editing controls are locked.

## Server routes

- `GET /`, `GET /viewer.js`, `GET /mermaid.min.js`: the page, its code, and Mermaid.
- `GET /api/diagrams`: list the `.mmd` files in the diagrams folder.
- `GET /api/diagrams/<name>`: read a diagram. It also records the diagram as the last opened file.
- `PUT /api/diagrams/<name>`: write a diagram.
- `GET /api/watch/<name>`: an event stream that sends a message when that diagram changes on disk.
- `GET /api/open-file`: show the macOS file window and read the file you pick. It records the path as the last opened file.
- `PUT /api/open-file`: write the opened file.
- `GET /api/opened-file`: read the opened file again.
- `GET /api/watch-opened`: an event stream that sends a message when the opened file changes on disk.
- `GET /api/last-opened`: tell the page which file to open at start-up.
