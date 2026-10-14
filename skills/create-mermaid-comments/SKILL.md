---
name: create-mermaid-comments
description: add a `// %% <short phrase>` comment above every statement that /create-mermaid turns into a diagram box, so the diagram can show plain-language node text instead of code. Takes optional file paths; with none, covers every file /create-mermaid covers.
allowed-tools: Read, Edit, Bash(git *), Bash(node *)
---

```!
node "${CLAUDE_PLUGIN_ROOT}/scripts/create-mermaid-comments/prompt.ts" $ARGUMENTS
```
