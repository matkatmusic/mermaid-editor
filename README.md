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

- **File menu:** click **File** at the top left. The menu holds **New**, **Save**, **Open file...**, **Reset**, **Classes...**, and **Diagrams**. The menu closes after you pick an item. **New** starts a document with one block, `B_NEW`, and 8 classes: `information`, `Decision`, `Yes-path`, `No-path`, `Checkpoint`, `Action`, `Question` and `Answer`. The block has no class until you pick one.
- **Diagrams:** open **Diagrams** in the File menu and pick a `.mmd` file from the diagrams folder.
- **Cmd-S:** does the same as **Save**, also while you type in the source editor. The browser save-page box stays closed.
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

- **Select a node:** click it. The node inspector opens below the diagram. The source editor marks the node's line. The phone view on the right shows the path to that node. Press **Escape** to clear the selection.
- **Select many nodes:** hold Cmd and click a node to add it to the selection. Hold Cmd and click a selected node to take it out. A click without Cmd selects only that node. Every selected node has the same highlight. While two or more nodes are selected, the node inspector shows no node, and a badge in the upper left corner of the diagram view says `selected: N nodes`. The badge stays in the corner when the diagram scrolls, it is above everything else on the page, and it goes away when one node or no node is selected. Press **Escape** to clear the whole selection.
- **Delete nodes:** press **Delete** or **Backspace** to remove every selected node, the same way the **Remove** button does. A decision with choices keeps the path of its first choice. All the removals are one undo step and one save. The keys work only when the focus is in the diagram view (you clicked a node and have not clicked a text box since). In a text box, Delete edits the text as usual.
- **Move along the arrows:** press the **Up** arrow key to select the node that leads to the selected node. Press the **Down** arrow key to select the node that the selected node leads to. If there are several, the first in the source order wins. The new node is centered. These keys also work only when the focus is in the diagram view.
- **Edit the node text fast:** double-click a node. The text in the **Node text** box becomes selected, so you can type the new text.
- **Connect two nodes:** hold Shift and click node A. Then hold Shift and click node B. The editor adds the line `A --> B`. A click without Shift, or a click on empty space, cancels the first pick. A second Shift-click on the same node does nothing.
- **Right-click menu:** right-click anywhere in the diagram. A menu opens at the pointer with **Add Decision Block** and **Add Static Block**. The new block has no arrows. **Add Decision Block** also adds **Yes** and **No** choices. The new node is selected and its text is selected, so you can type at once. Press **Escape** or click elsewhere to close the menu.
- **Zoom:** click **+** or **−** to change the zoom by 10 percent. **Cmd-plus** (or **Cmd-=**) and **Cmd-minus** do the same, and the browser page zoom stays off. Click **100%** to reset. The number beside the buttons shows the zoom. The file keeps the zoom.
- **Arrow heads at the edge:** when the end point of a connecting line (the point where its normal arrow head sits) is off screen, the main diagram draws one extra arrow head on that line at the last visible point of the line. It points along the line toward the end point, with its tip just inside the edge of the diagram area. It has the same shape and colour as the normal arrow head. A line with no visible part gets none. When the end point is on screen, only the normal arrow head shows. The extra heads update on scroll, zoom, window resize and every render. The phone view does not use them.
- **Dark mode:** the **Dark mode** box at the top switches the colors. It is on at the start.
- **Decisions:** click the left arrow or the right arrow after **Decisions:** to select and center the previous or next question. The keys **<** and **>** do the same, except while the cursor is in a text box. The counter shows, for example, `3 / 24`.
- **Functions only:** tick **Functions only** to show only the blocks that are function calls, like `doThing(x)`, and the calls between them.
- **Notes:** a node that has a note shows a small dot. The dot color is the opposite of the node color, so it stays easy to see.
- **Source editor:** click the three-line button between the source editor and the diagram to show or hide the source editor. Type in it to change the diagram at once. A problem shows in the box under the text. Each "Line N" in that box is a link: click it to open the source editor, scroll to line N, and select that line. A node definition that runs over more than one line shows "the definition of ... must start and end on one line". The numbers on the left are line numbers.

### The node inspector

The node inspector shows under the diagram when a node is selected. Its title says what kind of node it is.

- **Node text:** type the new text. **Enter**, **Tab**, or a click away writes it. **Shift-Enter** adds a line break and does not write. In the file, a line break is written as `<br/>`, so the node stays on one line. The box shows `<br>`, `<br/>`, `<br />` and a typed `\n` (a backslash and the letter n) as a real line break again. A save writes `<br/>`, but a text that already used `\n` keeps `\n`, so an edit with no change does not change the file. The phone view draws `\n` as a line break too, and the one-line lists show a space for it. Pasted text with line breaks gets the same change. A small line under the box says `shift-enter: new line`. A `"` you type is written as `#quot;` in the file and shows as `"` in every place that shows node text. Text in single backticks, like `` `bytes` ``, shows in a fixed-width font on a light box, with the backticks hidden, in the diagram and in the phone view. This box shows the backticks. A save writes every typed backtick as `#96;` in the file, because Mermaid cannot parse a text that starts with a backtick. A label that already has raw backticks in a file still shows its code spans, and it changes to `#96;` only when you save that node. The diagram gets the code tags before Mermaid sizes the nodes, so the wide text always fits in its node.
- **Node type row:** three boxes you cannot change: **Static**, **Question**, **Choice**. The box for the selected node is checked. For a choice, the row also says `- parent: <the question>`, or `parent: none` when no question leads to it.
- **Node Name:** shows the node's name without its first letters: `B_SAY_HELLO` shows `SAY_HELLO`, `Q_MOOD` shows `MOOD`, and `Q_CHOICE_MOOD_GOOD` shows `GOOD`. A choice name also loses the name of its parent question. The line under the box checks the name on every key you press. It says `result: <the full id>`, or `error: node names cannot contain <the characters>` (a space shows as `space`), or `error: node name cannot be empty`, or an error that the id is already used (also by a choice that the rename would make). The tool adds the first letters for you, and for a choice it adds the parent name too.
- **Rename:** **Enter**, **Tab**, or a click away renames the node in the whole file: its definition, every arrow, and the class lines. Only the whole name changes: renaming `Q_MOOD` does not touch `Q_MOODY`. The note lines are your own text and stay as they are. When you rename a decision, its choices `Q_CHOICE_<old name>_<answer>` get the new name too. If the name has an error and you press **Enter** or **Tab**, the old name comes back and the error stays on screen. If the name has an error and you click away, the bad name stays in the box and the error stays on screen. While the bad name is in the box, a click on another node, a Cmd-click, a double-click, and the **Up** and **Down** arrow keys do not move the selection. A small pop-up says `Fix the bad Node Name first.` and goes away after 4 seconds. The rename is one undo step and one save. The node stays selected.
- **Layout:** from top to bottom: row 1 is the type row, the Node Name box, and the check line. Row 2 is the **Node text** box on the left and the **Notes** box on the right. Row 3 is the **Class** list and the **Destination** list. Row 4 is the action buttons. The buttons are about 23 percent shorter than before (24 px, was 31 px) and keep the same font size.
- **Class:** see "Classes" below.
- **Notes:** type a note about the node. The note is saved as one line `%% ==note==: ...` above the node in the file. **Enter** or a click away writes it. **Shift-Enter** adds a line break; in the file it is written as `<br/>` inside that one line, and the box shows `<br>`, `<br/>` and `<br />` as a real line break again. A small line under the box says `shift-enter: new line`.
- **Destination:** blocks and choices have this list. It sets the one node that this node leads to. Pick **Terminal** for none, **New static block**, **New Decision block**, or any other node. The arrows that lead into this node stay. Each entry shows the node text on one line: `#quot;` shows as `"` and a line break shows as a space.
- **Walk back:** selects the node that leads to this node. If several nodes lead to it, a window asks which one. The window shows the node text on one line, the same way as the **Destination** list.
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
- **Cmd-Z** is undo. **Cmd-Shift-Z** is redo. They do nothing while the cursor is in a text box (the node inspector boxes, the search box, the source editor). There the browser keeps its own text undo.

### Search

- Press **Cmd-F** to put the cursor in **Search nodes** and select its text. The browser find box stays closed.
- Type in **Search nodes** at the top. The editor searches the text in the source editor. Capital letters do not matter. Each place where the text appears is one match. This works even when the diagram has a syntax error.
- Each key you type searches again. The first match is selected in the source editor and scrolled into view there. The cursor stays in the **Search nodes** box. If the drawer is closed, the search opens it.
- If the diagram has no syntax error and the match is on a line that holds a node, that node is also selected and moved into the center of the diagram. On a line with an arrow, the node is the one whose name or text holds the match. If the match is on the arrow, the first node of the line is used.
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

- **Several start nodes:** a start node is a node with no arrow into it. If the diagram has more than one, the frame shows only "Select a starting node to walk a path through that diagram" until you click a node in the diagram. **Reset decisions** brings that text back. A diagram with one start node does not show it.
- **Click a node in the diagram:** the frame shows the path from a start node to the clicked node. A clicked start node starts the walk at that node. If more than one path leads to the node, the shortest one is used. The walk then goes on to the next open question, and the frame draws a pulsing orange border around the clicked node for a few seconds. A clicked choice shows as the chosen answer.
- **Walk the diagram:** the frame shows the start. Click a choice button to answer a question. The next steps show. Past answers are dimmed. A question that has only one choice is answered for you.
- **Change an answer:** click a dimmed choice that has the return arrow to switch to that answer.
- **Undo, Reset decisions:** after the first answer, **Undo** takes back the last answer. **Reset decisions** clears all answers. **Reset** in the File menu clears the answers too.
- **Write path:** after the first answer, click **Write path**. The editor saves the path you chose as a new file named `<name>-path-<N>.mmd`. N is one more than the highest number already used. A diagram from the Diagrams list writes the file into the diagrams folder. A file from **Open file...** asks you once to pick a folder in the browser.
- **Export all paths:** click **Export all paths** at the top. The editor writes one file for every full path from every start node of the diagram, with the same names and numbers. The status shows `Writing 2/9 paths`. While it runs, the editing controls are locked.

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
