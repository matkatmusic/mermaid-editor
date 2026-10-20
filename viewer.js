// dom.ts
var darkModeToggle = document.getElementById("darkModeToggle");
var getMermaidOptions = () => ({ startOnLoad: false, suppressErrorRendering: true, maxTextSize: 1e6, theme: darkModeToggle.checked ? "dark" : "default", themeVariables: darkModeToggle.checked ? { primaryColor: "#ececff", nodeBkg: "#ececff", mainBkg: "#ececff", primaryTextColor: "#000", nodeTextColor: "#000", primaryBorderColor: "#9370db", nodeBorder: "#9370db" } : {} });
mermaid.initialize(getMermaidOptions());
var codeBox = document.getElementById("code");
var diagramBox = document.getElementById("diagram");
var errorBox = document.getElementById("error");
var errorLog = document.getElementById("errorLog");
var statusBox = document.getElementById("status");
var selectBox = document.getElementById("diagramSelect");
var currentFileName = document.getElementById("currentFileName");
var drawer = document.getElementById("drawer");
var drawerToggle = document.getElementById("drawerToggle");
var openFileBtn = document.getElementById("openFileBtn");
var openFileInput = document.getElementById("openFileInput");
var mainBox = document.getElementById("main");
var outputBox = document.getElementById("output");
var phoneDiagramBox = document.getElementById("phoneDiagram");
var previousDecisionBtn = document.getElementById("previousDecisionBtn");
var nextDecisionBtn = document.getElementById("nextDecisionBtn");
var decisionCounter = document.getElementById("decisionCounter");
var zoomInBtn = document.getElementById("zoomInBtn");
var zoomOutBtn = document.getElementById("zoomOutBtn");
var zoomResetBtn = document.getElementById("zoomResetBtn");
var zoomLevel = document.getElementById("zoomLevel");
var functionsOnlyToggle = document.getElementById("functionsOnlyToggle");
var nodeActions = document.getElementById("nodeActions");
var selectedNodeBox = document.getElementById("selectedNode");
var nodeInspector = document.getElementById("nodeInspector");
var nodeInspectorTitle = document.getElementById("nodeInspectorTitle");
var nodeTextInput = document.getElementById("nodeTextInput");
var nodeClassRow = document.getElementById("nodeClassRow");
var classPickerBtn = document.getElementById("classPickerBtn");
var classPickerSwatch = document.getElementById("classPickerSwatch");
var classPickerLabel = document.getElementById("classPickerLabel");
var classPickerList = document.getElementById("classPickerList");
var classEditorDialog = document.getElementById("classEditorDialog");
var classEditorName = document.getElementById("classEditorName");
var classEditorFill = document.getElementById("classEditorFill");
var classEditorStroke = document.getElementById("classEditorStroke");
var classEditorError = document.getElementById("classEditorError");
var classEditorCancelBtn = document.getElementById("classEditorCancelBtn");
var classEditorCreateBtn = document.getElementById("classEditorCreateBtn");
var classesMenuBtn = document.getElementById("classesMenuBtn");
var classesDialog = document.getElementById("classesDialog");
var classesList = document.getElementById("classesList");
var classesError = document.getElementById("classesError");
var classesNewBtn = document.getElementById("classesNewBtn");
var classesCloseBtn = document.getElementById("classesCloseBtn");
var nodeInspectorDismissBtn = document.getElementById("nodeInspectorDismissBtn");
var destinationRow = document.getElementById("destinationRow");
var destinationSelect = document.getElementById("destinationSelect");
var nodeInspectorActions = document.getElementById("nodeInspectorActions");
var nodeInspectorControls = document.getElementById("nodeInspectorControls");
var nodeInspectorRemovalPreview = document.getElementById("nodeInspectorRemovalPreview");
var searchInput = document.getElementById("searchInput");
var searchClearBtn = document.getElementById("searchClearBtn");
var searchPreviousBtn = document.getElementById("searchPreviousBtn");
var searchNextBtn = document.getElementById("searchNextBtn");
var searchCounter = document.getElementById("searchCounter");

// state.ts
var MAIN_ZOOM_STEP = 10;
var MIN_MAIN_ZOOM = 20;
var MAX_MAIN_ZOOM = 400;
var chosenAnswers = new Set;
var phonePath = [];
var NEW_STATIC_DESTINATION = "new-static";
var NEW_DECISION_DESTINATION = "new-decision";
var state = {
  renderId: 0,
  currentName: null,
  openedFileHandle: null,
  pathFolderHandle: null,
  loadedPath: null,
  watcher: null,
  currentBottomQ: undefined,
  phoneFocusNodeId: null,
  phoneFocusUsesDecisionContext: false,
  phonePreviewChoiceId: null,
  diagramScale: null,
  mainZoomPercent: 100,
  functionsOnly: false,
  selectedEditorNodeId: null,
  currentDecisionId: null,
  advanceAfterDecisionText: null,
  focusDestinationAfterTextId: null,
  pendingRemoval: null,
  editorHistory: [codeBox.value],
  editorHistoryIndex: 0,
  editorActionPromise: undefined
};
for (const key of Object.keys(state)) {
  Object.defineProperty(globalThis, key, {
    get: () => state[key],
    set: (value) => {
      state[key] = value;
    },
    configurable: true
  });
}

// diagram-source.ts
function parseEdges(text) {
  const edges = [];
  for (const rawLine of text.split(`
`)) {
    const line = rawLine.trim();
    const isComment = line.startsWith("%%");
    const hasArrow = line.includes("-->");
    const skipLine = isComment || !hasArrow;
    if (skipLine)
      continue;
    const ids = [];
    for (const s of line.split("-->")) {
      ids.push(s.trim());
    }
    for (let i = 0;i + 1 < ids.length; i++)
      edges.push([ids[i], ids[i + 1]]);
  }
  return edges;
}

// render-helpers.ts
function walkTrail(edges) {
  const bright = new Set;
  const visited = new Set;
  let node = edges[0][0];
  for (;; ) {
    const hasNode = !!node;
    if (!hasNode)
      break;
    const notVisited = !visited.has(node);
    if (!notVisited)
      break;
    visited.add(node);
    bright.add(node);
    const nextNodes = [];
    for (const [from, to] of edges) {
      if (from === node)
        nextNodes.push(to);
    }
    if (nextNodes.length <= 1) {
      node = nextNodes[0];
      continue;
    }
    let chosen;
    for (const option of nextNodes) {
      if (chosenAnswers.has(option)) {
        chosen = option;
        break;
      }
    }
    node = chosen;
    if (!node)
      for (const option of nextNodes)
        bright.add(option);
  }
  return bright;
}
function highlightPath() {
  const svgNodes = diagramBox.querySelectorAll("g.node");
  const svgEdges = diagramBox.querySelectorAll("path.flowchart-link");
  const edges = parseEdges(codeBox.value);
  const bright = chosenAnswers.size ? walkTrail(edges) : null;
  const isDim = (id) => bright !== null && !bright.has(id);
  for (const el of svgNodes)
    el.classList.toggle("dim", isDim(nodeIdOf(el)));
  for (const el of svgEdges) {
    const [from, to] = edgeEndsOf(el, edges);
    el.classList.toggle("dim", isDim(from) || isDim(to));
  }
}
function edgeEndsOf(el, edges) {
  let found;
  for (const edge of edges) {
    if (el.id.includes("L_" + edge[0] + "_" + edge[1] + "_")) {
      found = edge;
      break;
    }
  }
  return found || [];
}
function nodeIdOf(el) {
  return el.id.replace(/^.*flowchart-/, "").replace(/-\d+$/, "");
}
function showEditorValidationError(error) {
  const message = error instanceof Error ? error.message : String(error);
  errorBox.textContent = message;
  errorLog.textContent = message + `
`;
  errorLog.classList.add("open");
  errorLog.scrollTop = errorLog.scrollHeight;
}

// editor-types.ts
var INSPECTOR_TITLES = { question: "Decision block", block: "static block", choice: "choice block" };

class EditorValidationError extends Error {
  problems;
  constructor(problems) {
    super(`Invalid diagram:
${problems.join(`
`)}`);
    this.problems = problems;
    this.name = "EditorValidationError";
  }
}
var EDITOR_METADATA_FENCE = "%%%%====";
var EDITOR_METADATA_WARNING = "DO NOT MODIFY - AUTOMATICALLY GENERATED DURING EVERY SAVE";

// editor-graph.ts
function splitEditorMetadata(source) {
  const headerPattern = /(?:^|\r?\n)%%%%====\r?\n%% DO NOT MODIFY - AUTOMATICALLY GENERATED DURING EVERY SAVE\r?\n%% (\{[^\r\n]*\})\r?\n%%%%====/g;
  const matches = [...source.matchAll(headerPattern)];
  if (matches.length === 0)
    return { source, metadata: null };
  let metadata = null;
  try {
    const parsed = JSON.parse(matches[matches.length - 1][1]);
    if (parsed && typeof parsed === "object") {
      const lastSelectedNodeId = typeof parsed.lastSelectedNodeId === "string" || parsed.lastSelectedNodeId === null ? parsed.lastSelectedNodeId : null;
      metadata = {
        lastSelectedNodeId,
        outputScrollLeft: typeof parsed.outputScrollLeft === "number" ? parsed.outputScrollLeft : undefined,
        outputScrollTop: typeof parsed.outputScrollTop === "number" ? parsed.outputScrollTop : undefined,
        mainZoomPercent: typeof parsed.mainZoomPercent === "number" ? parsed.mainZoomPercent : undefined,
        typeColors: stringRecord(parsed.typeColors),
        nodeTypes: stringRecord(parsed.nodeTypes)
      };
    }
  } catch {}
  return { source: source.replace(headerPattern, "").replace(/\s+$/, ""), metadata };
}
function sourceWithEditorMetadata(source) {
  const body = splitEditorMetadata(source).source;
  const metadata = {
    lastSelectedNodeId: state.selectedEditorNodeId,
    outputScrollLeft: outputBox.scrollLeft,
    outputScrollTop: outputBox.scrollTop,
    mainZoomPercent: state.mainZoomPercent
  };
  return `${body}
${EDITOR_METADATA_FENCE}
%% ${EDITOR_METADATA_WARNING}
%% ${JSON.stringify(metadata)}
${EDITOR_METADATA_FENCE}`;
}
function stringRecord(value) {
  const isMissing = !value;
  const isNotObject = typeof value !== "object";
  const isArray = Array.isArray(value);
  if (isMissing || isNotObject || isArray)
    return;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string")
      result[key] = entry;
  }
  return result;
}
function restoreTypeMetadata(metadata) {}
function setEditorActionPromise(promise) {
  state.editorActionPromise = promise;
  window.editorActionPromise = promise;
}
setEditorActionPromise(Promise.resolve());
function stripEditorQuotes(text) {
  return text.replace(/^"(.*)"$/, "$1");
}
function parseEditorToken(token) {
  const match = token.match(/^([A-Za-z0-9_]+)([\s\S]*)$/);
  if (!match)
    return { id: token, shape: null, label: "" };
  const id = match[1];
  const rest = match[2].trim();
  if (rest.startsWith("{") && rest.endsWith("}"))
    return { id, shape: "brace", label: stripEditorQuotes(rest.slice(1, -1)) };
  if (rest.startsWith("([") && rest.endsWith("])"))
    return { id, shape: "other", label: stripEditorQuotes(rest.slice(2, -2)) };
  if (rest.startsWith("[") && rest.endsWith("]"))
    return { id, shape: "rect", label: stripEditorQuotes(rest.slice(1, -1)) };
  return { id, shape: null, label: "" };
}
function declarationRequirement(id) {
  if (id.startsWith("Q_CHOICE"))
    return 'start with "Q_CHOICE" and use bracket shape []';
  if (id.startsWith("Q_"))
    return 'start with "Q_" and use brace shape {}';
  if (id.startsWith("B_"))
    return 'start with "B_" and use bracket shape []';
  return 'use "Q_" with brace shape {} for a decision, "Q_CHOICE" with bracket shape [] for a choice, or "B_" with bracket shape [] for a static block';
}
function validateDeclaration(id, shape, lineNumber, problems) {
  const subject = `Line ${lineNumber}: id "${id}"`;
  if (shape === "other") {
    problems.push(`${subject} uses unsupported rounded/stadium shape; it must ${declarationRequirement(id)}.`);
    return;
  }
  if (id.startsWith("Q_CHOICE")) {
    if (shape !== "rect")
      problems.push(`${subject} is a choice and must use bracket shape [] (for example, ${id}["Choice"]).`);
    return;
  }
  if (id.startsWith("Q_")) {
    if (shape !== "brace")
      problems.push(`${subject} is a decision and must use brace shape {} (for example, ${id}{"Decision"}).`);
    return;
  }
  if (id.startsWith("B_")) {
    if (shape !== "rect")
      problems.push(`${subject} is a static block and must use bracket shape [] (for example, ${id}["Block"]).`);
    return;
  }
  problems.push(`${subject} has a non-compliant prefix; it must ${declarationRequirement(id)}.`);
}
function parseEditorEdgeLine(line) {
  const separator = /\s--\s(?:"([^"]*)"|(.+?))\s-->\s|\s-->/g;
  const tokens = [];
  const labels = [];
  let tokenStart = 0;
  for (let match;match = separator.exec(line); ) {
    tokens.push(line.slice(tokenStart, match.index).trim());
    labels.push(match[1] ?? match[2]?.trim());
    tokenStart = match.index + match[0].length;
  }
  if (tokens.length === 0)
    return null;
  tokens.push(line.slice(tokenStart).trim());
  if (tokens.some((token) => !token))
    return null;
  return tokens.slice(0, -1).map((fromToken, index) => ({ fromToken, label: labels[index], toToken: tokens[index + 1] }));
}
function declarationSuffixOf(node) {
  if (node.kind === "question")
    return `{"${node.label}"}`;
  if (node.kind === "choice")
    return `["${node.label}"]`;
  return `["${node.label}"]`;
}
function editorGraph() {
  const lines = codeBox.value.split(`
`);
  const declLines = new Map;
  const edges = [];
  const references = new Map;
  const problems = [];
  const recordDecl = (token, lineIndex) => {
    if (token.shape && !declLines.has(token.id))
      declLines.set(token.id, { shape: token.shape, label: token.label, lineIndex });
  };
  for (let lineIndex = 0;lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    const isSkippable = !line || line.startsWith("flowchart") || line.startsWith("classDef") || line.startsWith("class ") || line.startsWith("%%");
    if (isSkippable)
      continue;
    const parsedEdges = parseEditorEdgeLine(line);
    if (parsedEdges) {
      for (const edge of parsedEdges) {
        const from = parseEditorToken(edge.fromToken);
        const to = parseEditorToken(edge.toToken);
        for (const token of [from, to]) {
          references.set(token.id, lineIndex);
          if (token.shape) {
            problems.push(`Line ${lineIndex + 1}: id "${token.id}" is declared inline on an edge; node declarations must be on their own standalone lines.`);
            validateDeclaration(token.id, token.shape, lineIndex + 1, problems);
          }
        }
        edges.push({ from: from.id, to: to.id, label: edge.label, lineIndex });
      }
    } else {
      const decl = parseEditorToken(line);
      if (decl.shape) {
        recordDecl(decl, lineIndex);
        validateDeclaration(decl.id, decl.shape, lineIndex + 1, problems);
      }
    }
  }
  for (const [id, lineIndex] of references) {
    const isUndeclared = !declLines.has(id);
    if (isUndeclared)
      problems.push(`Line ${lineIndex + 1}: id "${id}" must be declared on its own standalone line and ${declarationRequirement(id)}.`);
  }
  const uniqueProblems = [...new Set(problems)];
  if (uniqueProblems.length) {
    const error = new EditorValidationError(uniqueProblems);
    showEditorValidationError(error);
    throw error;
  }
  const nodes = new Map;
  for (const [id, decl] of declLines) {
    const kind = id.startsWith("Q_CHOICE") ? "choice" : id.startsWith("Q_") ? "question" : "block";
    nodes.set(id, { id, kind, label: decl.label, lineIndex: decl.lineIndex });
  }
  return { lines, nodes, edges };
}

// class-defs.ts
var CLASSDEF_LINE_RE = /^(\s*)classDef\s+(\S+)\s+(.+?)\s*$/;
var CLASS_LINE_RE = /^(\s*)class\s+(\S+)\s+(\S+)\s*$/;
function isCommented(line) {
  return line.trim().startsWith("%%");
}
function parseStyleProps(styleText) {
  const order = [];
  const props = {};
  for (const part of styleText.split(",")) {
    const trimmed = part.trim();
    if (!trimmed)
      continue;
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1)
      continue;
    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();
    if (!(key in props))
      order.push(key);
    props[key] = value;
  }
  return { order, props };
}
function styleText(order, props) {
  return order.map((key) => `${key}:${props[key]}`).join(",");
}
function parseClassDefs(source) {
  const defs = [];
  const lines = source.split(`
`);
  for (let i = 0;i < lines.length; i++) {
    if (isCommented(lines[i]))
      continue;
    const match = lines[i].match(CLASSDEF_LINE_RE);
    if (!match)
      continue;
    const { props } = parseStyleProps(match[3]);
    defs.push({ name: match[2], fill: props.fill ?? "", stroke: props.stroke ?? "", lineIndex: i });
  }
  return defs;
}
function classDefByName(source, name) {
  for (const def of parseClassDefs(source)) {
    const isNamedClass = def.name === name;
    if (isNamedClass)
      return def;
  }
  return;
}
function classOfNode(source, nodeId) {
  let found = null;
  for (const line of source.split(`
`)) {
    if (isCommented(line))
      continue;
    const match = line.match(CLASS_LINE_RE);
    if (!match)
      continue;
    if (match[2].split(",").includes(nodeId))
      found = match[3];
  }
  return found;
}
function buildClassStyleIndex(source) {
  const assignments = new Map;
  for (const line of source.split(`
`)) {
    if (isCommented(line))
      continue;
    const match = line.match(CLASS_LINE_RE);
    if (!match)
      continue;
    for (const id of match[2].split(","))
      assignments.set(id, match[3]);
  }
  const defsByName = new Map(parseClassDefs(source).map((def) => [def.name, def]));
  return { assignments, defsByName };
}
function styleOfNode(index, nodeId) {
  const name = index.assignments.get(nodeId);
  if (!name)
    return null;
  const def = index.defsByName.get(name);
  if (!def)
    return null;
  return { name, fill: def.fill, stroke: def.stroke };
}
function withClassLineRemoved(lines, nodeId) {
  return lines.map((line) => {
    if (isCommented(line))
      return line;
    const match = line.match(CLASS_LINE_RE);
    if (!match)
      return line;
    const ids = match[2].split(",");
    const withoutId = ids.filter((id) => id !== nodeId);
    if (withoutId.length === ids.length)
      return line;
    if (withoutId.length === 0)
      return `%% ${line.trim()}`;
    return `${match[1]}class ${withoutId.join(",")} ${match[3]}`;
  });
}
function withAssignedClass(source, nodeId, className) {
  const lines = withClassLineRemoved(source.split(`
`), nodeId);
  if (className === null)
    return lines.join(`
`);
  let assigned = false;
  let lastClassLineIndex = -1;
  for (let i = 0;i < lines.length; i++) {
    if (isCommented(lines[i]))
      continue;
    const match = lines[i].match(CLASS_LINE_RE);
    if (!match)
      continue;
    lastClassLineIndex = i;
    if (match[3] === className) {
      lines[i] = `${match[1]}class ${match[2]},${nodeId} ${className}`;
      assigned = true;
    }
  }
  if (!assigned) {
    const newLine = `class ${nodeId} ${className}`;
    if (lastClassLineIndex === -1)
      lines.push(newLine);
    else
      lines.splice(lastClassLineIndex + 1, 0, newLine);
  }
  return lines.join(`
`);
}
function withCreatedClass(source, name, fill, stroke) {
  const lines = source.split(`
`);
  const newLine = `classDef ${name} fill:${fill},stroke:${stroke}`;
  let lastClassDefLineIndex = -1;
  for (let i = 0;i < lines.length; i++) {
    if (isCommented(lines[i]))
      continue;
    if (lines[i].match(CLASSDEF_LINE_RE))
      lastClassDefLineIndex = i;
  }
  if (lastClassDefLineIndex === -1)
    lines.push(newLine);
  else
    lines.splice(lastClassDefLineIndex + 1, 0, newLine);
  return lines.join(`
`);
}
function withClassColors(source, name, fill, stroke) {
  return source.split(`
`).map((line) => {
    if (isCommented(line))
      return line;
    const match = line.match(CLASSDEF_LINE_RE);
    if (!match || match[2] !== name)
      return line;
    const { order, props } = parseStyleProps(match[3]);
    if (!order.includes("fill"))
      order.push("fill");
    if (!order.includes("stroke"))
      order.push("stroke");
    props.fill = fill;
    props.stroke = stroke;
    return `${match[1]}classDef ${name} ${styleText(order, props)}`;
  }).join(`
`);
}
function withRenamedClass(source, oldName, newName) {
  return source.split(`
`).map((line) => {
    if (isCommented(line))
      return line;
    const classDefMatch = line.match(CLASSDEF_LINE_RE);
    if (classDefMatch && classDefMatch[2] === oldName)
      return `${classDefMatch[1]}classDef ${newName} ${classDefMatch[3]}`;
    const classMatch = line.match(CLASS_LINE_RE);
    if (classMatch && classMatch[3] === oldName)
      return `${classMatch[1]}class ${classMatch[2]} ${newName}`;
    return line;
  }).join(`
`);
}
function withDeletedClass(source, name) {
  return source.split(`
`).map((line) => {
    if (isCommented(line))
      return line;
    const match = line.match(CLASSDEF_LINE_RE);
    if (!match || match[2] !== name)
      return line;
    return `%% ${line.trim()}`;
  }).join(`
`);
}
async function assignClass(nodeId, className) {
  await applyEditorSource(withAssignedClass(codeBox.value, nodeId, className));
}
async function createClass(name, fill, stroke) {
  await applyEditorSource(withCreatedClass(codeBox.value, name, fill, stroke));
}
async function setClassColors(name, fill, stroke) {
  await applyEditorSource(withClassColors(codeBox.value, name, fill, stroke));
}
async function renameClass(oldName, newName) {
  await applyEditorSource(withRenamedClass(codeBox.value, oldName, newName));
}
async function deleteClass(name) {
  await applyEditorSource(withDeletedClass(codeBox.value, name));
}

// source-edit.ts
function sourceWithLinesReplaced(graph, removedLineIndexes, newLines) {
  const kept = [];
  for (let lineIndex = 0;lineIndex < graph.lines.length; lineIndex++) {
    const isRemoved = removedLineIndexes.has(lineIndex);
    if (!isRemoved)
      kept.push(graph.lines[lineIndex]);
  }
  let classBlockStart = -1;
  for (let i = 0;i < kept.length; i++) {
    const trimmed = kept[i].trim();
    const isClassDef = trimmed.startsWith("classDef");
    const isClassAssignment = trimmed.startsWith("class ");
    const isClassLine = isClassDef || isClassAssignment;
    if (isClassLine) {
      classBlockStart = i;
      break;
    }
  }
  if (classBlockStart === -1)
    return [...kept, ...newLines].join(`
`);
  return [...kept.slice(0, classBlockStart), ...newLines, ...kept.slice(classBlockStart)].join(`
`);
}
function nextEditorId(prefix, graph) {
  let n = 1;
  while (graph.nodes.has(`${prefix}_${n}`))
    n++;
  return `${prefix}_${n}`;
}
function choiceId(questionId, suffix) {
  return `Q_CHOICE_${questionId.replace(/^Q_/, "")}_${suffix}`;
}
function outgoingDestination(id, graph) {
  return graph.edges.find((edge) => edge.from === id)?.to;
}
function sourceWithOutgoingChanged(id, destination, graph) {
  const removedLineIndexes = new Set;
  const restoredIds = new Set;
  const newLines = [];
  for (const edge of graph.edges) {
    if (edge.from !== id)
      continue;
    removedLineIndexes.add(edge.lineIndex);
    for (const endpointId of [edge.from, edge.to]) {
      const endpoint = graph.nodes.get(endpointId);
      if (endpoint && endpoint.lineIndex === edge.lineIndex && !restoredIds.has(endpointId)) {
        restoredIds.add(endpointId);
        newLines.push(`  ${endpointId}${declarationSuffixOf(endpoint)}`);
      }
    }
  }
  if (destination)
    newLines.push(`  ${id} --> ${destination}`);
  return sourceWithLinesReplaced(graph, removedLineIndexes, newLines);
}
function replaceOutgoing(id, destination, graph) {
  return sourceWithOutgoingChanged(id, destination, graph);
}
function removeOutgoing(id, graph) {
  return sourceWithOutgoingChanged(id, undefined, graph);
}
function preserveInlineDecl(edge, keepEndpointId, graph, newLines) {
  const node = graph.nodes.get(keepEndpointId);
  if (node && node.lineIndex === edge.lineIndex)
    newLines.push(`  ${keepEndpointId}${declarationSuffixOf(node)}`);
}

// node-inspector.ts
function replaceDeclarationInLine(line, id, newToken) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escapedId}(\\{[^}]*\\}|\\[[^\\]]*\\]|\\(\\[[^\\]]*\\]\\))`);
  return line.replace(re, newToken);
}
function inspectorActionButton(action, label, spanTwoColumns = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.textContent = label;
  button.classList.toggle("span-2", spanTwoColumns);
  return button;
}
function renderNodeInspector() {
  let graph;
  try {
    graph = editorGraph();
  } catch {
    nodeInspector.hidden = true;
    blurInspectorFocus();
    return;
  }
  const node = graph.nodes.get(state.selectedEditorNodeId ?? "");
  nodeInspector.hidden = !node;
  if (!node) {
    nodeTextInput.value = "";
    blurInspectorFocus();
    return;
  }
  const previewing = !!state.pendingRemoval;
  nodeInspectorTitle.textContent = INSPECTOR_TITLES[node.kind];
  nodeTextInput.value = node.label;
  nodeClassRow.hidden = previewing;
  if (!previewing)
    renderClassPicker(node);
  nodeInspectorRemovalPreview.hidden = !previewing;
  nodeInspectorActions.hidden = previewing;
  nodeInspectorControls.hidden = previewing;
  if (previewing) {
    positionNodeInspector();
    return;
  }
  const actions = [inspectorActionButton("remove", "Remove")];
  if (node.kind === "question")
    actions.push(inspectorActionButton("add-choice", "Add choice"), inspectorActionButton("remove-choices", "Remove choices"), inspectorActionButton("insert-static-before", "insert static block before"), inspectorActionButton("insert-decision-before", "insert Decision & leading choice before"));
  else if (node.kind === "block")
    actions.push(inspectorActionButton("add-decision-after", "add Decision block after"), inspectorActionButton("insert-decision-after", "Insert decision block after"), inspectorActionButton("insert-static-after", "Insert static block after"), inspectorActionButton("insert-static-before", "insert static block before"), inspectorActionButton("insert-decision-before", "insert Decision & leading choice before"));
  else if (node.kind === "choice")
    actions.push(inspectorActionButton("add-decision-after", "add Decision block after"), inspectorActionButton("add-static-after", "add static block after"), inspectorActionButton("insert-decision-after", "Insert decision block after"), inspectorActionButton("insert-static-after", "Insert static block after"));
  nodeInspectorActions.replaceChildren(...actions);
  const hasDestination = node.kind !== "question";
  destinationRow.hidden = !hasDestination;
  destinationSelect.replaceChildren();
  if (hasDestination) {
    destinationSelect.add(new Option("Terminal", ""));
    destinationSelect.add(new Option("New static block", NEW_STATIC_DESTINATION));
    destinationSelect.add(new Option("New Decision block", NEW_DECISION_DESTINATION));
    const destination = outgoingDestination(node.id, graph);
    const candidates = Array.from(graph.nodes.values());
    for (let i = 0;i < candidates.length; i++) {
      const candidate = candidates[i];
      const isSelf = candidate.id === node.id;
      const isHiddenChoice = candidate.kind === "choice" && candidate.id !== destination;
      if (isSelf)
        continue;
      if (isHiddenChoice)
        continue;
      destinationSelect.add(new Option(`${candidate.label} (${candidate.id})`, candidate.id));
    }
    destinationSelect.value = destination ?? "";
    nodeInspectorDismissBtn.textContent = destination ? "Cancel" : "Close";
  } else {
    nodeInspectorDismissBtn.textContent = "Cancel";
  }
  positionNodeInspector();
}
function renderClassPicker(node) {
  const source = codeBox.value;
  const className = classOfNode(source, node.id);
  const def = className ? classDefByName(source, className) : undefined;
  classPickerBtn.dataset.nodeId = node.id;
  classPickerLabel.textContent = className ?? "(none)";
  classPickerSwatch.style.background = def ? def.fill : "transparent";
  classPickerSwatch.style.borderColor = def ? def.stroke : "#999";
  const rows = [];
  for (const classDef of parseClassDefs(source))
    rows.push(`<button type="button" class="class-picker-row" data-class-name="${classDef.name}"><span class="class-swatch" style="background:${classDef.fill};border-color:${classDef.stroke}"></span>${classDef.name}</button>`);
  rows.push('<button type="button" class="class-picker-row" data-class-none>(none)</button>');
  rows.push('<button type="button" class="class-picker-row" data-class-new>new...</button>');
  classPickerList.innerHTML = rows.join("");
  classPickerList.hidden = true;
}
function positionNodeInspector() {}
function focusInspectorText() {
  nodeTextInput.focus();
  nodeTextInput.select();
}
function focusInspectorDestination() {
  destinationSelect.focus();
}
function blurInspectorFocus() {
  const active = document.activeElement;
  const isFocusedElement = active instanceof HTMLElement;
  for (const el of isFocusedElement ? [active] : []) {
    const isInsideInspector = nodeInspector.contains(el);
    if (isInsideInspector)
      el.blur();
  }
}

// diagram-io.ts
function setStatus(text) {
  statusBox.textContent = text;
  function clearStatusIfUnchanged() {
    if (statusBox.textContent === text)
      statusBox.textContent = state.loadedPath ?? "";
  }
  setTimeout(clearStatusIfUnchanged, 2000);
}
function setDrawerOpen(open) {
  drawer.classList.toggle("closed", !open);
  positionNodeInspector();
}
async function loadList() {
  currentFileName.textContent = state.currentName ?? "";
  const listResponse = await fetch("/api/diagrams");
  const names = await listResponse.json();
  selectBox.innerHTML = '<option value="" disabled ' + (state.currentName ? "" : "selected") + ">Diagrams</option>";
  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    if (name === state.currentName)
      option.selected = true;
    selectBox.appendChild(option);
  }
}
function resetEditorHistory(text) {
  state.editorHistory = [text];
  state.editorHistoryIndex = 0;
  selectEditorNode(null);
}
function applyMainViewport(metadata, graph) {
  const hasSavedLeft = typeof metadata?.outputScrollLeft === "number";
  const hasSavedTop = typeof metadata?.outputScrollTop === "number";
  if (hasSavedLeft)
    outputBox.scrollLeft = metadata.outputScrollLeft;
  if (hasSavedTop)
    outputBox.scrollTop = metadata.outputScrollTop;
  if (hasSavedLeft) {
    if (hasSavedTop)
      return;
  }
  const firstNode = graph.nodes.values().next().value;
  if (!firstNode)
    return;
  const node = diagramBox.querySelector('[id*="flowchart-' + firstNode.id + '-"]');
  if (!node)
    return;
  const outputRect = outputBox.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  const nodeLeft = outputBox.scrollLeft + nodeRect.left - outputRect.left;
  const nodeTop = outputBox.scrollTop + nodeRect.top - outputRect.top;
  if (!hasSavedLeft)
    outputBox.scrollLeft = Math.max(0, nodeLeft - 12);
  if (!hasSavedTop)
    outputBox.scrollTop = Math.max(0, nodeTop - 12);
}

// decision-nav.ts
function decisionNodes(graph) {
  return [...graph.nodes.values()].filter((node) => node.kind === "question").sort((a, b) => a.lineIndex - b.lineIndex);
}
function nearestFeedingChoice(id, graph) {
  const visited = new Set([id]);
  let frontier = [id];
  while (frontier.length) {
    const nextFrontier = [];
    for (const nodeId of frontier) {
      const node = graph.nodes.get(nodeId);
      const isAnswerKind = node?.kind === "choice" || node?.kind === "question";
      const isChoiceFedByDecision = isAnswerKind && graph.edges.some((edge) => edge.to === nodeId && graph.nodes.get(edge.from)?.kind === "question");
      if (isChoiceFedByDecision)
        return nodeId;
      for (const edge of graph.edges) {
        if (edge.to !== nodeId || visited.has(edge.from))
          continue;
        visited.add(edge.from);
        nextFrontier.push(edge.from);
      }
    }
    frontier = nextFrontier;
  }
  return null;
}
function discardInvalidPhonePreview(graph) {
  if (state.phoneFocusNodeId && graph.nodes.get(state.phoneFocusNodeId)?.kind !== "question") {
    state.phoneFocusNodeId = null;
    state.phoneFocusUsesDecisionContext = false;
  }
  if (state.phonePreviewChoiceId && nearestFeedingChoice(state.phonePreviewChoiceId, graph) !== state.phonePreviewChoiceId)
    state.phonePreviewChoiceId = null;
}
function updateDecisionCounter(graph) {
  const decisions = decisionNodes(graph);
  if (decisions.length === 0) {
    state.currentDecisionId = null;
    decisionCounter.textContent = "0 / 0";
    return decisions;
  }
  if (!decisions.some((node) => node.id === state.currentDecisionId)) {
    const selectedDecision = decisions.find((node) => node.id === state.selectedEditorNodeId);
    state.currentDecisionId = selectedDecision?.id ?? decisions[0].id;
  }
  const current = decisions.findIndex((node) => node.id === state.currentDecisionId) + 1;
  decisionCounter.textContent = `${current} / ${decisions.length}`;
  return decisions;
}
function centerNodeInViewport(container, diagram, id) {
  const node = diagram.querySelector('[id*="flowchart-' + id + '-"]');
  if (!node)
    return;
  const containerRect = container.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  container.scrollLeft += nodeRect.left + nodeRect.width / 2 - containerRect.left - container.clientWidth / 2;
  container.scrollTop += nodeRect.top + nodeRect.height / 2 - containerRect.top - container.clientHeight / 2;
}
async function navigateDecision(step) {
  let graph;
  try {
    graph = editorGraph();
  } catch (error) {
    showEditorValidationError(error);
    return;
  }
  const decisions = updateDecisionCounter(graph);
  if (decisions.length === 0) {
    setStatus("No decisions in this diagram");
    return;
  }
  const selected = graph.nodes.get(state.selectedEditorNodeId ?? "");
  const anchorId = selected?.kind === "question" ? selected.id : state.currentDecisionId;
  const currentIndex = decisions.findIndex((node) => node.id === anchorId);
  const nextIndex = (currentIndex + step + decisions.length) % decisions.length;
  const decision = decisions[nextIndex];
  state.currentDecisionId = decision.id;
  state.phoneFocusNodeId = decision.id;
  state.phoneFocusUsesDecisionContext = true;
  state.phonePreviewChoiceId = null;
  selectEditorNode(decision.id);
  updateDecisionCounter(graph);
  await render();
  selectEditorNode(decision.id);
  updateDecisionCounter(graph);
  centerNodeInViewport(outputBox, diagramBox, decision.id);
}

// function-routing.ts
var SIGNATURE = /^[A-Za-z_$][A-Za-z0-9_$]*\(.*\)/;
function isFunctionLabel(label) {
  return SIGNATURE.test(label.trim());
}
function isFunctionNode(node) {
  return node.id.startsWith("B_") && isFunctionLabel(node.label);
}
function leadingId(segment) {
  const match = segment.trim().match(/^([A-Za-z0-9_]+)/);
  return match ? match[1] : segment.trim();
}
function parseDeclaration(line, lineIndex) {
  const match = line.match(/^([A-Za-z0-9_]+)([\s\S]*)$/);
  if (!match)
    return null;
  const id = match[1];
  const rest = match[2].trim();
  const isBrace = rest.startsWith("{") && rest.endsWith("}");
  const isRect = rest.startsWith("[") && rest.endsWith("]");
  if (!isBrace && !isRect)
    return null;
  const label = rest.slice(1, -1).replace(/^"(.*)"$/, "$1");
  const kind = id.startsWith("Q_CHOICE") ? "choice" : id.startsWith("Q_") ? "question" : "block";
  return { id, kind, label, lineIndex };
}
function parseRoutingGraph(source) {
  const nodes = new Map;
  const edges = [];
  let header = "flowchart TD";
  const lines = source.split(`
`);
  for (let lineIndex = 0;lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    if (!line)
      continue;
    if (line.startsWith("flowchart")) {
      header = line;
      continue;
    }
    const isMeta = line.startsWith("classDef") || line.startsWith("class ") || line.startsWith("%%");
    if (isMeta)
      continue;
    if (line.includes("-->")) {
      const segments = line.split("-->");
      for (let i = 0;i + 1 < segments.length; i++)
        edges.push([leadingId(segments[i]), leadingId(segments[i + 1])]);
      continue;
    }
    const decl = parseDeclaration(line, lineIndex);
    if (decl && !nodes.has(decl.id))
      nodes.set(decl.id, decl);
  }
  return { header, nodes, edges };
}
function calleesOf(callerId, functionIds, edges) {
  const found = [];
  const visited = new Set;
  const stack = [callerId];
  while (stack.length) {
    const node = stack.pop();
    for (const [from, to] of edges) {
      if (from !== node)
        continue;
      if (functionIds.has(to)) {
        if (!found.includes(to))
          found.push(to);
        continue;
      }
      if (!visited.has(to)) {
        visited.add(to);
        stack.push(to);
      }
    }
  }
  return found;
}
function filterToFunctions(source) {
  const graph = parseRoutingGraph(source);
  const functionNodes = [...graph.nodes.values()].filter(isFunctionNode).sort((a, b) => a.lineIndex - b.lineIndex);
  const functionIds = new Set(functionNodes.map((node) => node.id));
  const lines = [graph.header];
  for (const node of functionNodes)
    lines.push(`  ${node.id}["${node.label}"]`);
  for (const caller of functionNodes) {
    const callees = calleesOf(caller.id, functionIds, graph.edges).map((id) => graph.nodes.get(id)).sort((a, b) => a.lineIndex - b.lineIndex);
    for (const callee of callees)
      lines.push(`  ${caller.id} --> ${callee.id}`);
  }
  return lines.join(`
`);
}

// graph-slice.ts
function parentOf(id, edges) {
  let found;
  for (const edge of edges) {
    if (edge[1] === id) {
      found = edge;
      break;
    }
  }
  return found[0];
}
function contextualDecisionSliceIds(decisionId, edges) {
  const reversed = [decisionId];
  const visited = new Set(reversed);
  let node = decisionId;
  for (;; ) {
    let incoming;
    for (const edge of edges) {
      const isMatch = edge[1] === node;
      if (isMatch) {
        incoming = edge;
        break;
      }
    }
    if (!incoming)
      break;
    const predecessor = incoming[0];
    if (visited.has(predecessor))
      break;
    reversed.push(predecessor);
    visited.add(predecessor);
    const isPreviousDecision = predecessor.startsWith("Q_") && !predecessor.startsWith("Q_CHOICE");
    if (isPreviousDecision)
      break;
    node = predecessor;
  }
  const ids = reversed.reverse();
  for (const choice of choicesOf(decisionId, edges)) {
    if (!visited.has(choice))
      ids.push(choice);
  }
  return ids;
}
function sliceIds(edges) {
  const focusNodeId = state.functionsOnly ? null : state.phoneFocusNodeId;
  const hasFocusedDecisionContext = focusNodeId !== null && state.phoneFocusUsesDecisionContext;
  if (hasFocusedDecisionContext)
    return contextualDecisionSliceIds(focusNodeId, edges);
  const last = state.functionsOnly ? undefined : state.phonePreviewChoiceId ?? phonePath[phonePath.length - 1];
  const ids = focusNodeId ? [focusNodeId] : last ? [parentOf(last, edges), last] : [edges.map(([from]) => from).find((from) => !edges.some(([, to]) => to === from))];
  let node = ids[ids.length - 1];
  const visited = new Set(ids);
  for (;; ) {
    const next = [];
    for (const [from, to] of edges) {
      if (from === node)
        next.push(to);
    }
    if (next.length === 0)
      return ids;
    if (next.length > 1)
      return ids.concat(next);
    node = next[0];
    if (visited.has(node))
      return ids;
    ids.push(node);
    visited.add(node);
  }
}
function siblingIds(ids, edges) {
  const hasDecisionContext = state.phoneFocusUsesDecisionContext || state.phonePreviewChoiceId || phonePath.length;
  if (!hasDecisionContext)
    return [];
  const found = [];
  for (const [from, to] of edges) {
    const isFromFirst = from === ids[0];
    const isNotSecond = to !== ids[1];
    const isSibling = isFromFirst && isNotSecond;
    if (isSibling)
      found.push(to);
  }
  return found;
}
function choicesOf(id, edges) {
  const found = [];
  for (const [from, to] of edges) {
    if (from === id)
      found.push(to);
  }
  return found;
}

// node-type-colors.ts
var UNCLASSED_STRIPE_PATTERN_ID = "unclassed-stripe-pattern";
function addUnclassedStripePattern(svg) {
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.insertBefore(defs, svg.firstChild);
  }
  const existingPattern = defs.querySelector("#" + UNCLASSED_STRIPE_PATTERN_ID);
  if (existingPattern)
    return;
  defs.insertAdjacentHTML("beforeend", `<pattern id="${UNCLASSED_STRIPE_PATTERN_ID}" width="16" height="16" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#fde8e8"/><rect width="8" height="16" fill="#f4b4b4"/></pattern>`);
}
function applyNodeTypeColors(graph) {
  const svg = diagramBox.querySelector("svg");
  if (!svg)
    return;
  const classIndex = buildClassStyleIndex(codeBox.value);
  for (const nodeEl of diagramBox.querySelectorAll("g.node")) {
    const node = graph.nodes.get(nodeIdOf(nodeEl));
    if (!node)
      continue;
    const isClassed = !!styleOfNode(classIndex, node.id);
    if (isClassed)
      continue;
    addUnclassedStripePattern(svg);
    for (const shape of nodeEl.querySelectorAll("rect, path, polygon"))
      shape.style.fill = `url(#${UNCLASSED_STRIPE_PATTERN_ID})`;
  }
}

// zoom.ts
function viewBoxOf(svgText) {
  const match = svgText.match(/viewBox="[^"]*?\s([\d.]+)\s([\d.]+)"/);
  const [, w, h] = match;
  return { width: Number(w), height: Number(h) };
}
function applyMainZoom(preserveViewportCenter = true) {
  zoomLevel.textContent = `${state.mainZoomPercent}%`;
  zoomInBtn.disabled = state.mainZoomPercent >= MAX_MAIN_ZOOM;
  zoomOutBtn.disabled = state.mainZoomPercent <= MIN_MAIN_ZOOM;
  zoomResetBtn.disabled = state.mainZoomPercent === 100;
  const svg = diagramBox.querySelector("svg");
  const scale = state.diagramScale;
  const hasSvg = svg !== null;
  const hasScale = scale !== null;
  if (!hasSvg)
    return;
  if (!hasScale)
    return;
  const oldWidth = Number.parseFloat(svg.style.width);
  const oldHeight = Number.parseFloat(svg.style.height);
  const centerX = outputBox.scrollLeft + outputBox.clientWidth / 2;
  const centerY = outputBox.scrollTop + outputBox.clientHeight / 2;
  const zoom = state.mainZoomPercent / 100;
  const newWidth = svg.viewBox.baseVal.width * scale * zoom;
  const newHeight = svg.viewBox.baseVal.height * scale * zoom;
  svg.style.width = newWidth + "px";
  svg.style.height = newHeight + "px";
  const hadWidth = oldWidth > 0;
  const hadHeight = oldHeight > 0;
  if (preserveViewportCenter) {
    if (hadWidth) {
      if (hadHeight) {
        outputBox.scrollLeft = centerX * newWidth / oldWidth - outputBox.clientWidth / 2;
        outputBox.scrollTop = centerY * newHeight / oldHeight - outputBox.clientHeight / 2;
      }
    }
  }
}
function setMainZoomPercent(percent) {
  state.mainZoomPercent = Math.max(MIN_MAIN_ZOOM, Math.min(MAX_MAIN_ZOOM, Math.round(percent)));
  applyMainZoom();
}

// phone-render.ts
function findRoot(edges) {
  for (const [candidate] of edges) {
    let hasIncoming = false;
    for (const [, to] of edges) {
      const targetsCandidate = to === candidate;
      if (targetsCandidate) {
        hasIncoming = true;
        break;
      }
    }
    if (!hasIncoming)
      return candidate;
  }
  return;
}
function buildHistoryRows(edges, graph) {
  if (edges.length === 0) {
    const sorted = [...graph.nodes.values()].sort((a, b) => a.lineIndex - b.lineIndex);
    const standaloneRows = [];
    for (const node of sorted) {
      const isBlock = node.kind === "block";
      if (isBlock)
        standaloneRows.push({ status: "block", id: node.id });
      else
        standaloneRows.push({ status: "active", id: node.id });
    }
    return standaloneRows;
  }
  const rows = [];
  let cur = findRoot(edges);
  let pathIndex = 0;
  const maxSteps = graph.nodes.size + phonePath.length + 1;
  for (let step = 0;step < maxSteps; step++) {
    if (cur === undefined)
      break;
    const kind = graph.nodes.get(cur)?.kind ?? "block";
    if (kind === "question") {
      const choices = choicesOf(cur, edges);
      const hasAnswer = pathIndex < phonePath.length && choices.includes(phonePath[pathIndex]);
      if (!hasAnswer) {
        rows.push({ status: "active", id: cur });
        break;
      }
      const answered = phonePath[pathIndex];
      const declinedChoiceIds = [];
      for (const choiceId of choices) {
        const isChosen = choiceId === answered;
        if (!isChosen)
          declinedChoiceIds.push(choiceId);
      }
      rows.push({ status: "past", id: cur, chosenChoiceId: answered, declinedChoiceIds, revertIndex: pathIndex });
      pathIndex++;
      const isAnswerAQuestion = graph.nodes.get(answered)?.kind === "question";
      cur = isAnswerAQuestion ? answered : choicesOf(answered, edges)[0];
      continue;
    }
    if (kind === "block")
      rows.push({ status: "block", id: cur });
    const nexts = choicesOf(cur, edges);
    const isSingleChain = nexts.length === 1;
    cur = isSingleChain ? nexts[0] : undefined;
  }
  return rows;
}
function isPhoneShowingHistory() {
  const hasFocusedDecision = !state.functionsOnly && state.phoneFocusUsesDecisionContext && !!state.phoneFocusNodeId;
  const hasPreviewChoice = !state.functionsOnly && !!state.phonePreviewChoiceId;
  return !hasFocusedDecision && !hasPreviewChoice;
}
function findAnswersLeadingTo(questionId, edges, graph) {
  const root = findRoot(edges);
  const queue = [{ nodeId: root, answers: [] }];
  const visited = new Set;
  for (let i = 0;i < queue.length; i++) {
    const { nodeId, answers } = queue[i];
    if (nodeId === undefined)
      continue;
    if (nodeId === questionId)
      return answers;
    const isVisited = visited.has(nodeId);
    if (isVisited)
      continue;
    visited.add(nodeId);
    const isQuestion = graph.nodes.get(nodeId)?.kind === "question";
    if (isQuestion) {
      for (const choiceId of choicesOf(nodeId, edges)) {
        const isChoiceAQuestion = graph.nodes.get(choiceId)?.kind === "question";
        const nextNodeId = isChoiceAQuestion ? choiceId : choicesOf(choiceId, edges)[0];
        queue.push({ nodeId: nextNodeId, answers: [...answers, choiceId] });
      }
      continue;
    }
    const nexts = choicesOf(nodeId, edges);
    const isSingleChain = nexts.length === 1;
    if (isSingleChain)
      queue.push({ nodeId: nexts[0], answers });
  }
  throw new Error(`No phone path leads from the start to ${questionId}`);
}

// phone-rows.ts
function buildRowsFromIdSequence(ids, graph, activeId, leadChosenId, leadDeclinedIds) {
  const rows = [];
  const seen = new Set;
  const leadQuestionId = ids[0];
  for (const id of ids) {
    const alreadySeen = seen.has(id);
    if (alreadySeen)
      continue;
    seen.add(id);
    const kind = graph.nodes.get(id)?.kind;
    const isChoice = kind === "choice";
    if (isChoice)
      continue;
    const isBlock = kind === "block";
    if (isBlock) {
      rows.push({ status: "block", id });
      continue;
    }
    const isQuestion = kind === "question";
    if (!isQuestion)
      continue;
    const isActive = id === activeId;
    if (isActive) {
      rows.push({ status: "active", id });
      continue;
    }
    const isLeadQuestion = id === leadQuestionId;
    const hasLeadChoice = leadChosenId !== undefined;
    const isAnsweredLeadQuestion = isLeadQuestion && hasLeadChoice;
    if (isAnsweredLeadQuestion)
      rows.push({ status: "past", id, chosenChoiceId: leadChosenId, declinedChoiceIds: leadDeclinedIds });
  }
  return rows;
}
function buildFocusRows(edges, graph, focusNodeId) {
  const ids = sliceIds(edges);
  const siblings = siblingIds(ids, edges);
  return buildRowsFromIdSequence(ids, graph, focusNodeId, ids[1], siblings);
}
function buildPreviewRows(edges, graph) {
  const ids = sliceIds(edges);
  const siblings = siblingIds(ids, edges);
  const reversedIds = [...ids].reverse();
  let activeId;
  for (const id of reversedIds) {
    const isQuestion = graph.nodes.get(id)?.kind === "question";
    const isLeadQuestion = id === ids[0];
    const isEarlierQuestion = isQuestion && !isLeadQuestion;
    if (isEarlierQuestion) {
      activeId = id;
      break;
    }
  }
  return buildRowsFromIdSequence(ids, graph, activeId ?? ids[0], ids[1], siblings);
}
function buildRows(edges, graph) {
  const hasFocusedDecision = !state.functionsOnly && state.phoneFocusUsesDecisionContext && !!state.phoneFocusNodeId;
  if (hasFocusedDecision)
    return buildFocusRows(edges, graph, state.phoneFocusNodeId);
  const hasPreviewChoice = !state.functionsOnly && !!state.phonePreviewChoiceId;
  if (hasPreviewChoice)
    return buildPreviewRows(edges, graph);
  return buildHistoryRows(edges, graph);
}

// phone-html.ts
var UNCLASSED_PHONE_STYLE = "background:repeating-linear-gradient(45deg, #f4b4b4 0 8px, #fde8e8 8px 16px)";
var classIndex = { assignments: new Map, defsByName: new Map };
function getPhoneNodeAppearance(node) {
  const classStyle = styleOfNode(classIndex, node.id);
  if (!classStyle)
    return { boxStyle: UNCLASSED_PHONE_STYLE, labelStyle: "" };
  return { boxStyle: `background:${classStyle.fill};border:2px solid ${classStyle.stroke}`, labelStyle: "" };
}
function encodeHtml(text) {
  const withAmp = text.replace(/&/g, "&amp;");
  const withLt = withAmp.replace(/</g, "&lt;");
  const withGt = withLt.replace(/>/g, "&gt;");
  const withQuote = withGt.replace(/"/g, "&quot;");
  return withQuote.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
}
function getLabelOf(id, graph) {
  return graph.nodes.get(id)?.label ?? id;
}
function buildChoiceButtonsHtml(choices, row, graph) {
  const isPast = row.status === "past";
  const declinedCount = choices.length - 1;
  const declinedPct = 30 / declinedCount;
  const buttons = [];
  for (const choiceId of choices) {
    const label = encodeHtml(getLabelOf(choiceId, graph));
    const isActive = row.status === "active";
    if (isActive) {
      buttons.push(`<button type="button" class="phone-choice" data-node-id="${choiceId}" data-choose="${choiceId}">${label}</button>`);
      continue;
    }
    if (!isPast)
      continue;
    const isChosen = choiceId === row.chosenChoiceId;
    if (isChosen) {
      buttons.push(`<button type="button" class="phone-choice phone-choice-chosen" style="flex:0 1 70%" data-node-id="${choiceId}" disabled>${label}</button>`);
      continue;
    }
    const style = `style="flex:0 1 ${declinedPct}%"`;
    const canRevert = row.revertIndex !== undefined;
    if (canRevert)
      buttons.push(`<button type="button" class="phone-choice phone-choice-declined" ${style} data-node-id="${choiceId}" data-revert="${row.revertIndex}:${choiceId}">&#8634; ${label}</button>`);
    else
      buttons.push(`<button type="button" class="phone-choice phone-choice-declined" ${style} data-node-id="${choiceId}" disabled>${label}</button>`);
  }
  return `<div class="phone-choice-row">${buttons.join("")}</div>`;
}
function buildRowHtml(row, graph, edges, isMasked) {
  const node = graph.nodes.get(row.id);
  if (!node)
    return "";
  if (row.status === "block") {
    const blockClass = isMasked ? "phone-block phone-block-past" : "phone-block";
    const { boxStyle, labelStyle } = getPhoneNodeAppearance(node);
    return `<div class="${blockClass}" data-node-id="${row.id}" style="${boxStyle}"><span style="${labelStyle}">${encodeHtml(getLabelOf(row.id, graph))}</span></div>`;
  }
  const choices = choicesOf(row.id, edges);
  const activeAttr = row.status === "active" ? " data-active-question" : "";
  const { boxStyle: questionBoxStyle, labelStyle: questionLabelStyle } = getPhoneNodeAppearance(node);
  const question = `<div class="phone-question" data-node-id="${row.id}"${activeAttr} style="${questionBoxStyle}"><span style="${questionLabelStyle}">${encodeHtml(getLabelOf(row.id, graph))}</span></div>`;
  const wrapClass = isMasked ? "phone-decision phone-decision-past" : "phone-decision";
  return `<div class="${wrapClass}">${question}<div class="phone-choice-count">${choices.length} choices</div>${buildChoiceButtonsHtml(choices, row, graph)}</div>`;
}
function renderPhone(edges, graph) {
  classIndex = buildClassStyleIndex(codeBox.value);
  const rows = buildRows(edges, graph);
  let lastPastIndex = -1;
  let hasOpenQuestion = false;
  for (let i = 0;i < rows.length; i++) {
    const isPast = rows[i].status === "past";
    if (isPast)
      lastPastIndex = i;
    const isOpenQuestion = rows[i].status === "active";
    if (isOpenQuestion)
      hasOpenQuestion = true;
  }
  const historyParts = [];
  const footerParts = [];
  for (let i = 0;i < rows.length; i++) {
    const isMasked = i <= lastPastIndex;
    const html = buildRowHtml(rows[i], graph, edges, isMasked);
    const isAfterLastAnswer = i > lastPastIndex;
    const isFixedInPlace = isAfterLastAnswer ? hasOpenQuestion : false;
    const target = isFixedInPlace ? footerParts : historyParts;
    target.push(html);
  }
  const hasFixedRows = footerParts.length > 0;
  if (lastPastIndex >= 0) {
    if (hasFixedRows)
      footerParts.unshift('<hr class="phone-separator">');
  }
  const hasAnswer = phonePath.length > 0;
  const topBar = hasAnswer ? '<div id="phoneTopBar"><button type="button" class="phone-undo" data-undo>&#8630; Undo</button><button type="button" class="phone-undo" data-reset-decisions>Reset decisions</button><button type="button" class="phone-undo" data-write-path>Write path</button></div>' : "";
  phoneDiagramBox.innerHTML = `${topBar}<div id="phoneHistory">${historyParts.join("")}</div><div id="phoneFooter">${footerParts.join("")}</div>`;
  const historyBox = phoneDiagramBox.querySelector("#phoneHistory");
  if (historyBox)
    historyBox.scrollTop = historyBox.scrollHeight;
}

// render.ts
async function render() {
  errorBox.textContent = "";
  try {
    const graph = editorGraph();
    discardInvalidPhonePreview(graph);
    updateDecisionCounter(graph);
    const edges = parseEdges(codeBox.value);
    let phonePathIsStale = false;
    for (const id of phonePath) {
      let idIsInDiagram = false;
      for (const [, to] of edges) {
        const isTarget = to === id;
        if (isTarget)
          idIsInDiagram = true;
      }
      if (!idIsInDiagram)
        phonePathIsStale = true;
    }
    if (phonePathIsStale)
      phonePath.length = 0;
    const ids = edges.length > 0 ? sliceIds(edges) : [];
    const reversedIds = [...ids].reverse();
    let bottomQ = state.phoneFocusNodeId && graph.nodes.get(state.phoneFocusNodeId)?.kind === "question" ? state.phoneFocusNodeId : undefined;
    if (!bottomQ) {
      for (const rid of reversedIds) {
        let outgoingCount = 0;
        for (const [from] of edges) {
          if (from === rid)
            outgoingCount++;
        }
        const hasBranch = outgoingCount > 1;
        if (hasBranch) {
          bottomQ = rid;
          break;
        }
      }
    }
    state.currentBottomQ = bottomQ;
    const mainSource = state.functionsOnly ? filterToFunctions(codeBox.value) : codeBox.value;
    const phoneEdges = state.functionsOnly ? parseEdges(filterToFunctions(codeBox.value)) : edges;
    const regularViewport = { left: outputBox.scrollLeft, top: outputBox.scrollTop };
    const myRenderId = state.renderId;
    const { svg: regularSvg } = await mermaid.render("diagram-" + state.renderId++, mainSource);
    if (state.renderId !== myRenderId + 1)
      return;
    const hasEdges = edges.length > 0;
    const scaleIsUnset = state.diagramScale === null;
    if (hasEdges) {
      if (scaleIsUnset)
        state.diagramScale = 1;
    }
    diagramBox.innerHTML = regularSvg;
    renderPhone(phoneEdges, graph);
    applyNodeTypeColors(graph);
    renderEditorSelection();
    highlightPath();
    if (edges.length > 0) {
      const scale = state.diagramScale;
      const mainZoom = state.mainZoomPercent / 100;
      const regularSvgEl = diagramBox.querySelector("svg");
      const regularBox = viewBoxOf(regularSvg);
      regularSvgEl.style.width = regularBox.width * scale * mainZoom + "px";
      regularSvgEl.style.height = regularBox.height * scale * mainZoom + "px";
    }
    outputBox.scrollLeft = regularViewport.left;
    outputBox.scrollTop = regularViewport.top;
    positionNodeInspector();
    errorLog.textContent = "";
    errorLog.classList.remove("open");
  } catch (err) {
    state.currentDecisionId = null;
    decisionCounter.textContent = "0 / 0";
    showEditorValidationError(err);
  }
}
functionsOnlyToggle.addEventListener("change", () => {
  state.functionsOnly = functionsOnlyToggle.checked;
  render();
});
darkModeToggle.addEventListener("change", () => {
  document.body.classList.toggle("dark", darkModeToggle.checked);
  mermaid.initialize(getMermaidOptions());
  render();
});

// diagram-save.ts
var lastSavedDiagramText = null;
var watchedDiagramName = null;
var pendingSaveCount = 0;
var saveVersion = 0;
function setLastSavedDiagramText(text) {
  lastSavedDiagramText = text;
}
function createDiagramWatcher(name) {
  if (state.watcher)
    state.watcher.close();
  watchedDiagramName = name;
  const source = new EventSource("/api/watch/" + encodeURIComponent(name));
  state.watcher = source;
  const refresh = async () => {
    const versionAtFetchStart = saveVersion;
    const saveInFlightAtFetchStart = pendingSaveCount > 0;
    const diagramResponse = await fetch("/api/diagrams/" + encodeURIComponent(name));
    const text = await diagramResponse.text();
    const isStaleWatcher = state.watcher !== source;
    if (isStaleWatcher)
      return;
    if (saveInFlightAtFetchStart)
      return;
    if (pendingSaveCount > 0)
      return;
    if (saveVersion !== versionAtFetchStart)
      return;
    if (text === lastSavedDiagramText)
      return;
    if (text !== codeBox.value) {
      restoreTypeMetadata(splitEditorMetadata(text).metadata);
      codeBox.value = text;
      resetEditorHistory(text);
    }
    render();
  };
  source.onmessage = refresh;
  source.onopen = refresh;
}
var MMD_FILE_TYPES = [{ description: "Mermaid diagram", accept: { "text/plain": [".mmd"] } }];
async function saveDiagram() {
  const needsSaveAsDialog = !state.currentName && !state.openedFileHandle && !state.loadedPath;
  if (needsSaveAsDialog) {
    try {
      state.openedFileHandle = await window.showSaveFilePicker({ suggestedName: "diagram.mmd", types: MMD_FILE_TYPES });
    } catch (error) {
      const isUserCancel = error.name === "AbortError";
      if (!isUserCancel)
        throw error;
      console.log("User canceled Save");
      return;
    }
  }
  const fileHandle = state.openedFileHandle;
  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(codeBox.value);
    await writable.close();
    setStatus("Saved " + fileHandle.name);
    return;
  }
  const hasNoName = !state.currentName;
  const hasLoadedPath = !!state.loadedPath;
  const savesToLoadedPath = hasNoName && hasLoadedPath;
  if (savesToLoadedPath) {
    const openFileResponse = await fetch("/api/open-file", { method: "PUT", body: codeBox.value });
    if (!openFileResponse.ok)
      throw new Error(await openFileResponse.text());
    setStatus("Saved " + state.loadedPath);
    return;
  }
  const name = state.currentName;
  lastSavedDiagramText = codeBox.value;
  pendingSaveCount++;
  saveVersion++;
  try {
    await fetch("/api/diagrams/" + encodeURIComponent(name), {
      method: "PUT",
      body: codeBox.value
    });
  } finally {
    pendingSaveCount--;
  }
  state.currentName = name;
  setStatus("Saved " + name);
  loadList();
  const hasNoWatcher = !state.watcher;
  if (hasNoWatcher) {
    createDiagramWatcher(name);
  } else {
    const isWatchingSomethingElse = watchedDiagramName !== name;
    if (isWatchingSomethingElse)
      createDiagramWatcher(name);
  }
}

// editor-actions.ts
async function applyEditorSource(source, options) {
  source = sourceWithEditorMetadata(source);
  await mermaid.parse(source);
  codeBox.value = source;
  const recordHistory = options?.recordHistory !== false;
  if (recordHistory) {
    state.editorHistory = state.editorHistory.slice(0, state.editorHistoryIndex + 1);
    state.editorHistory.push(source);
    state.editorHistoryIndex = state.editorHistory.length - 1;
  }
  await render();
  const hasSaveTarget = !!state.currentName || !!state.openedFileHandle || !!state.loadedPath;
  if (!hasSaveTarget)
    throw new Error("No diagram file is loaded to auto-save into");
  await saveDiagram();
  selectEditorNode(state.selectedEditorNodeId);
}
function clearFailedAction() {}
function appendEditorAction(action) {
  setEditorActionPromise(state.editorActionPromise.catch(clearFailedAction).then(action));
}
function executeEditorAction(action) {
  appendEditorAction(action);
}
function selectEditorNode(id) {
  state.selectedEditorNodeId = id;
  if (state.advanceAfterDecisionText?.decisionId !== id)
    state.advanceAfterDecisionText = null;
  if (state.focusDestinationAfterTextId !== id)
    state.focusDestinationAfterTextId = null;
  state.pendingRemoval = null;
  nodeActions.classList.remove("removing");
  nodeActions.classList.toggle("open", !!id);
  selectedNodeBox.textContent = id ?? "";
  renderEditorSelection();
  renderNodeInspector();
}
function renderEditorSelection() {
  for (const el of diagramBox.querySelectorAll(".editor-selected"))
    el.classList.remove("editor-selected");
  for (const el of diagramBox.querySelectorAll(".editor-preview"))
    el.classList.remove("editor-preview");
  if (state.selectedEditorNodeId) {
    const el = diagramBox.querySelector('[id*="flowchart-' + state.selectedEditorNodeId + '-"]');
    if (el)
      el.classList.add("editor-selected");
  }
  if (state.pendingRemoval) {
    const target = state.pendingRemoval.choices[state.pendingRemoval.index];
    const el = diagramBox.querySelector('[id*="flowchart-' + target + '-"]');
    if (el)
      el.classList.add("editor-preview");
  }
}
function renderRemovalPreview() {
  renderEditorSelection();
  renderNodeInspector();
}

// editor-add.ts
function addQuestionAfter() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = editorGraph();
  const selected = state.selectedEditorNodeId;
  const removedLineIndexes = new Set;
  const successors = [];
  for (const edge of graph.edges) {
    if (edge.from !== selected)
      continue;
    successors.push(edge.to);
    removedLineIndexes.add(edge.lineIndex);
  }
  const qId = nextEditorId("Q_NEW", graph);
  const yesId = choiceId(qId, "Y");
  const noId = choiceId(qId, "N");
  const newLines = [
    `  ${selected} --> ${qId}`,
    `  ${qId}{"New question"}`,
    `  ${yesId}["Yes"]`,
    `  ${noId}["No"]`,
    `  ${qId} --> ${yesId}`,
    `  ${qId} --> ${noId}`
  ];
  for (const edge of graph.edges) {
    if (edge.from !== selected)
      continue;
    preserveInlineDecl(edge, edge.to, graph, newLines);
  }
  for (const successor of successors) {
    newLines.push(`  ${yesId} --> ${successor}`);
    newLines.push(`  ${noId} --> ${successor}`);
  }
  setEditorActionPromise(applyEditorSource(sourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
function addBlockAfter() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = editorGraph();
  const selected = state.selectedEditorNodeId;
  const removedLineIndexes = new Set;
  const successors = [];
  const newLines = [];
  for (const edge of graph.edges) {
    if (edge.from !== selected)
      continue;
    successors.push(edge.to);
    removedLineIndexes.add(edge.lineIndex);
    preserveInlineDecl(edge, edge.to, graph, newLines);
  }
  const bId = nextEditorId("B_NEW", graph);
  newLines.unshift(`  ${selected} --> ${bId}`, `  ${bId}["New block"]`);
  for (const successor of successors)
    newLines.push(`  ${bId} --> ${successor}`);
  setEditorActionPromise(applyEditorSource(sourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
function insertStaticBefore() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = editorGraph();
  const selected = state.selectedEditorNodeId;
  const selectedNode = graph.nodes.get(selected);
  const removedLineIndexes = new Set;
  const predecessors = [];
  for (const edge of graph.edges) {
    if (edge.to !== selected)
      continue;
    predecessors.push(edge);
    removedLineIndexes.add(edge.lineIndex);
  }
  const staticId = nextEditorId("B_NEW", graph);
  const newLines = [`  ${staticId}["New static block"]`];
  const restoredInlineDecls = new Set;
  const restoreInlineDecl = (edge, endpointId) => {
    const node = graph.nodes.get(endpointId);
    if (node && node.lineIndex === edge.lineIndex && !restoredInlineDecls.has(endpointId)) {
      restoredInlineDecls.add(endpointId);
      newLines.push(`  ${endpointId}${declarationSuffixOf(node)}`);
    }
  };
  if (removedLineIndexes.has(selectedNode.lineIndex))
    newLines.push(`  ${selected}${declarationSuffixOf(selectedNode)}`);
  restoredInlineDecls.add(selected);
  for (const edge of predecessors)
    restoreInlineDecl(edge, edge.from);
  for (const edge of predecessors)
    newLines.push(edge.label ? `  ${edge.from} -- "${edge.label}" --> ${staticId}` : `  ${edge.from} --> ${staticId}`);
  newLines.push(`  ${staticId} --> ${selected}`);
  for (const edge of graph.edges) {
    if (!removedLineIndexes.has(edge.lineIndex) || edge.to === selected)
      continue;
    restoreInlineDecl(edge, edge.from);
    restoreInlineDecl(edge, edge.to);
    newLines.push(edge.label ? `  ${edge.from} -- "${edge.label}" --> ${edge.to}` : `  ${edge.from} --> ${edge.to}`);
  }
  setEditorActionPromise(applyEditorSource(sourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
function insertDecisionBefore() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = editorGraph();
  const selected = state.selectedEditorNodeId;
  const selectedNode = graph.nodes.get(selected);
  const removedLineIndexes = new Set;
  const predecessors = [];
  for (const edge of graph.edges) {
    if (edge.to !== selected)
      continue;
    predecessors.push(edge);
    removedLineIndexes.add(edge.lineIndex);
  }
  const decisionId = nextEditorId("Q_NEW", graph);
  const newChoiceId = choiceId(decisionId, "NEW");
  const newLines = [
    `  ${decisionId}{"New Decision"}`,
    `  ${newChoiceId}["New choice"]`,
    `  ${decisionId} --> ${newChoiceId}`
  ];
  if (removedLineIndexes.has(selectedNode.lineIndex))
    newLines.push(`  ${selected}${declarationSuffixOf(selectedNode)}`);
  for (const edge of predecessors)
    preserveInlineDecl(edge, edge.from, graph, newLines);
  for (const edge of predecessors)
    newLines.push(edge.label ? `  ${edge.from} -- "${edge.label}" --> ${decisionId}` : `  ${edge.from} --> ${decisionId}`);
  newLines.push(`  ${newChoiceId} --> ${selected}`);
  setEditorActionPromise(applyEditorSource(sourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
function choiceSuffixFromLabel(label) {
  return label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "CHOICE";
}
function addChoice() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = editorGraph();
  const questionId = state.selectedEditorNodeId;
  const labelled = graph.edges.find((e) => e.from === questionId && e.label);
  const removedLineIndexes = new Set;
  const newLines = [];
  if (labelled) {
    removedLineIndexes.add(labelled.lineIndex);
    const suffix = choiceSuffixFromLabel(labelled.label);
    const cid = choiceId(questionId, suffix);
    const targetSuffix = (() => {
      const node = graph.nodes.get(labelled.to);
      return node && node.lineIndex === labelled.lineIndex ? declarationSuffixOf(node) : "";
    })();
    newLines.push(`  ${cid}["${labelled.label}"]`, `  ${questionId} --> ${cid}`, `  ${cid} --> ${labelled.to}${targetSuffix}`);
  } else {
    let suffix = "NEW";
    let n = 1;
    while (graph.nodes.has(choiceId(questionId, suffix)))
      suffix = "NEW" + ++n;
    const cid = choiceId(questionId, suffix);
    newLines.push(`  ${cid}["New choice"]`, `  ${questionId} --> ${cid}`);
  }
  setEditorActionPromise(applyEditorSource(sourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}

// editor-remove.ts
function removeChoice() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = editorGraph();
  const id = state.selectedEditorNodeId;
  const node = graph.nodes.get(id);
  const removedLineIndexes = new Set;
  const newLines = [];
  if (node)
    removedLineIndexes.add(node.lineIndex);
  for (const edge of graph.edges) {
    const touchesRemoved = edge.from === id || edge.to === id;
    if (!touchesRemoved)
      continue;
    removedLineIndexes.add(edge.lineIndex);
    const otherEndpoint = edge.from === id ? edge.to : edge.from;
    if (otherEndpoint !== id)
      preserveInlineDecl(edge, otherEndpoint, graph, newLines);
  }
  selectEditorNode(null);
  setEditorActionPromise(applyEditorSource(sourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
function removeBlock() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = editorGraph();
  const id = state.selectedEditorNodeId;
  const node = graph.nodes.get(id);
  const removedLineIndexes = new Set;
  const newLines = [];
  const predecessors = [];
  const successors = [];
  if (node)
    removedLineIndexes.add(node.lineIndex);
  for (const edge of graph.edges) {
    const touchesRemoved = edge.from === id || edge.to === id;
    if (!touchesRemoved)
      continue;
    removedLineIndexes.add(edge.lineIndex);
    if (edge.from === id) {
      successors.push(edge.to);
      preserveInlineDecl(edge, edge.to, graph, newLines);
    } else {
      predecessors.push(edge.from);
      preserveInlineDecl(edge, edge.from, graph, newLines);
    }
  }
  for (const predecessor of predecessors)
    for (const successor of successors)
      newLines.push(`  ${predecessor} --> ${successor}`);
  selectEditorNode(null);
  setEditorActionPromise(applyEditorSource(sourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
function removeQuestion() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = editorGraph();
  const questionId = state.selectedEditorNodeId;
  const choices = [];
  for (const edge of graph.edges) {
    if (edge.from === questionId)
      choices.push(edge.to);
  }
  if (!choices.length)
    return;
  state.pendingRemoval = { questionId, choices, index: 0 };
  nodeActions.classList.add("removing");
  renderRemovalPreview();
}
function removeChoices() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = editorGraph();
  const questionId = state.selectedEditorNodeId;
  const removedLineIndexes = new Set;
  const newLines = [];
  for (const edge of graph.edges) {
    if (edge.from !== questionId)
      continue;
    removedLineIndexes.add(edge.lineIndex);
    const targetNode = graph.nodes.get(edge.to);
    const isImmediateChoice = targetNode?.kind === "choice";
    if (!isImmediateChoice) {
      preserveInlineDecl(edge, edge.to, graph, newLines);
      continue;
    }
    const choiceNodeId = edge.to;
    removedLineIndexes.add(targetNode.lineIndex);
    for (const inner of graph.edges) {
      if (inner === edge)
        continue;
      const touchesChoice = inner.from === choiceNodeId || inner.to === choiceNodeId;
      if (!touchesChoice)
        continue;
      removedLineIndexes.add(inner.lineIndex);
      const otherEndpoint = inner.from === choiceNodeId ? inner.to : inner.from;
      if (otherEndpoint !== choiceNodeId)
        preserveInlineDecl(inner, otherEndpoint, graph, newLines);
    }
  }
  setEditorActionPromise(applyEditorSource(sourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
function advanceRemovalPreview() {
  if (!state.pendingRemoval)
    return;
  state.pendingRemoval.index = (state.pendingRemoval.index + 1) % state.pendingRemoval.choices.length;
  renderRemovalPreview();
}
function cancelQuestionRemoval() {
  selectEditorNode(null);
}
function confirmQuestionRemoval() {
  if (!state.pendingRemoval)
    return;
  const { questionId, choices, index } = state.pendingRemoval;
  const graph = editorGraph();
  const removedLineIndexes = new Set;
  const newLines = [];
  const qNode = graph.nodes.get(questionId);
  if (qNode)
    removedLineIndexes.add(qNode.lineIndex);
  const predecessors = [];
  for (const edge of graph.edges) {
    if (edge.to !== questionId)
      continue;
    predecessors.push(edge.from);
    removedLineIndexes.add(edge.lineIndex);
    preserveInlineDecl(edge, edge.from, graph, newLines);
  }
  let keepSuccessor = choices[index];
  for (const edge of graph.edges) {
    if (edge.from !== questionId)
      continue;
    removedLineIndexes.add(edge.lineIndex);
    const targetNode = graph.nodes.get(edge.to);
    const isImmediateChoice = targetNode?.kind === "choice";
    if (!isImmediateChoice) {
      preserveInlineDecl(edge, edge.to, graph, newLines);
      continue;
    }
    removedLineIndexes.add(targetNode.lineIndex);
    for (const inner of graph.edges) {
      if (inner.from !== edge.to)
        continue;
      removedLineIndexes.add(inner.lineIndex);
      if (edge.to === keepSuccessor) {
        preserveInlineDecl(inner, inner.to, graph, newLines);
        keepSuccessor = inner.to;
      }
    }
  }
  for (const predecessor of predecessors)
    newLines.push(`  ${predecessor} --> ${keepSuccessor}`);
  executeEditorAction(() => applyEditorSource(sourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
function undoEditorAction() {
  if (state.editorHistoryIndex <= 0)
    return;
  state.editorHistoryIndex--;
  selectEditorNode(null);
  executeEditorAction(() => applyEditorSource(state.editorHistory[state.editorHistoryIndex], { recordHistory: false }));
}
function redoEditorAction() {
  if (state.editorHistoryIndex >= state.editorHistory.length - 1)
    return;
  state.editorHistoryIndex++;
  selectEditorNode(null);
  executeEditorAction(() => applyEditorSource(state.editorHistory[state.editorHistoryIndex], { recordHistory: false }));
}

// diagram-load.ts
async function loadDiagram(name) {
  if (state.watcher) {
    state.watcher.close();
    state.watcher = null;
  }
  const diagramResponse = await fetch("/api/diagrams/" + encodeURIComponent(name));
  state.loadedPath = diagramResponse.headers.get("X-Diagram-Path");
  const text = await diagramResponse.text();
  setLastSavedDiagramText(text);
  const { metadata } = splitEditorMetadata(text);
  restoreTypeMetadata(metadata);
  state.currentName = name;
  sessionStorage.setItem("loadedDiagram", name);
  state.openedFileHandle = null;
  statusBox.textContent = state.loadedPath ?? "";
  phonePath.length = 0;
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  state.diagramScale = null;
  state.currentDecisionId = metadata?.lastSelectedNodeId ?? null;
  state.mainZoomPercent = metadata?.mainZoomPercent ?? 100;
  codeBox.value = text;
  resetEditorHistory(text);
  await render();
  applyMainZoom(false);
  let graph = null;
  try {
    graph = editorGraph();
  } catch {}
  if (metadata) {
    const hasSavedSelection = graph?.nodes.has(metadata.lastSelectedNodeId ?? "");
    if (hasSavedSelection)
      selectEditorNode(metadata.lastSelectedNodeId);
  }
  if (graph)
    applyMainViewport(metadata, graph);
  loadList();
  createDiagramWatcher(name);
}

// path-export.ts
function getChosenPathIds() {
  const rows = buildHistoryRows(parseEdges(codeBox.value), editorGraph());
  const ids = [];
  for (const row of rows) {
    const isAlreadyListed = ids[ids.length - 1] === row.id;
    if (!isAlreadyListed)
      ids.push(row.id);
    const isAnsweredDecision = row.status === "past";
    if (isAnsweredDecision)
      ids.push(row.chosenChoiceId);
  }
  return ids;
}
function getPlainLabel(id, graph) {
  return graph.nodes.get(id).label.replace(/<br\s*\/?>/gi, " ");
}
function buildDecisionComment(ids, graph) {
  const lines = ["%% Decisions made:"];
  for (let i = 0;i + 1 < ids.length; i++) {
    const isDecision = graph.nodes.get(ids[i]).kind === "question";
    if (!isDecision)
      continue;
    lines.push(`%%   ${getPlainLabel(ids[i], graph)} -> ${getPlainLabel(ids[i + 1], graph)}`);
  }
  const hasNoDecisions = lines.length === 1;
  if (hasNoDecisions)
    lines.push("%%   none");
  return lines;
}
function buildClassLines(declaredIds) {
  const classIndex = buildClassStyleIndex(codeBox.value);
  const idsByClass = new Map;
  for (const id of declaredIds) {
    const className = classIndex.assignments.get(id);
    if (!className)
      continue;
    const classIds = idsByClass.get(className) ?? [];
    classIds.push(id);
    idsByClass.set(className, classIds);
  }
  const sourceLines = codeBox.value.split(`
`);
  const lines = [];
  for (const [className, classIds] of idsByClass) {
    const classDef = classIndex.defsByName.get(className);
    if (classDef)
      lines.push(`  ${sourceLines[classDef.lineIndex].trim()}`);
    lines.push(`  class ${classIds.join(",")} ${className}`);
  }
  return lines;
}
function buildChosenPathSource(ids) {
  const graph = editorGraph();
  const lines = [...buildDecisionComment(ids, graph), "flowchart TD"];
  const declaredIds = new Set;
  for (const id of ids) {
    const isDeclared = declaredIds.has(id);
    if (isDeclared)
      continue;
    declaredIds.add(id);
    lines.push(`  ${id}${declarationSuffixOf(graph.nodes.get(id))}`);
  }
  for (let i = 0;i + 1 < ids.length; i++)
    lines.push(`  ${ids[i]} --> ${ids[i + 1]}`);
  lines.push(...buildClassLines(declaredIds));
  return lines.join(`
`) + `
`;
}
function findNextPathFileName(baseName, existingNames) {
  const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedBaseName}-path-(\\d+)\\.mmd$`);
  let nextNumber = 0;
  for (const name of existingNames) {
    const match = name.match(pattern);
    if (!match)
      continue;
    const usedNumber = Number(match[1]);
    if (usedNumber >= nextNumber)
      nextNumber = usedNumber + 1;
  }
  return `${baseName}-path-${nextNumber}.mmd`;
}
async function writeToServerDiagrams(diagramName, source) {
  const existingNames = await fetch("/api/diagrams").then((r) => r.json());
  const fileName = findNextPathFileName(diagramName.replace(/\.mmd$/, ""), existingNames);
  const response = await fetch("/api/diagrams/" + encodeURIComponent(fileName), { method: "PUT", body: source });
  if (!response.ok)
    throw new Error(`Writing ${fileName} failed: ${response.status} ${await response.text()}`);
  setStatus("Wrote " + fileName);
}
async function selectPathFolder() {
  if (state.pathFolderHandle)
    return true;
  try {
    state.pathFolderHandle = await window.showDirectoryPicker({ mode: "readwrite" });
  } catch (error) {
    const isUserCancel = error.name === "AbortError";
    if (!isUserCancel)
      throw error;
    return false;
  }
  return true;
}
async function writeToOpenedFileFolder(openedFileName, source) {
  const hasFolder = await selectPathFolder();
  if (!hasFolder) {
    console.log("User canceled Write chosen path");
    return;
  }
  const folder = state.pathFolderHandle;
  const existingNames = [];
  for await (const name of folder.keys())
    existingNames.push(name);
  const fileName = findNextPathFileName(openedFileName.replace(/\.mmd$/, ""), existingNames);
  const fileHandle = await folder.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(source);
  await writable.close();
  setStatus("Wrote " + fileName);
}
async function writeChosenPath() {
  const source = buildChosenPathSource(getChosenPathIds());
  if (state.currentName) {
    await writeToServerDiagrams(state.currentName, source);
    return;
  }
  if (!state.openedFileHandle)
    throw new Error("Save the diagram before writing a chosen path");
  await writeToOpenedFileFolder(state.openedFileHandle.name, source);
}

// path-export-all.ts
function collectPaths(path, usedEdges, edges, paths) {
  const current = path[path.length - 1];
  let hasUnusedEdge = false;
  for (const [from, to] of edges) {
    const edgeKey = `${from}->${to}`;
    const isUnusedOutgoing = from === current && !usedEdges.has(edgeKey);
    if (!isUnusedOutgoing)
      continue;
    hasUnusedEdge = true;
    usedEdges.add(edgeKey);
    path.push(to);
    collectPaths(path, usedEdges, edges, paths);
    path.pop();
    usedEdges.delete(edgeKey);
  }
  if (!hasUnusedEdge)
    paths.push([...path]);
}
function listAllPathIds(edges) {
  const paths = [];
  const root = findRoot(edges);
  if (root === undefined)
    return paths;
  collectPaths([root], new Set, edges, paths);
  return paths;
}
async function writeAllPaths() {
  const sources = [];
  for (const ids of listAllPathIds(parseEdges(codeBox.value)))
    sources.push(buildChosenPathSource(ids));
  if (state.currentName) {
    setStatus(`Writing 0/${sources.length} paths`);
    for (let writtenCount = 1;writtenCount <= sources.length; writtenCount++) {
      await writeToServerDiagrams(state.currentName, sources[writtenCount - 1]);
      setStatus(`Writing ${writtenCount}/${sources.length} paths`);
    }
  } else {
    if (!state.openedFileHandle)
      throw new Error("Save the diagram before exporting all paths");
    const hasFolder = await selectPathFolder();
    if (!hasFolder) {
      console.log("User canceled Export all paths");
      return;
    }
    setStatus(`Writing 0/${sources.length} paths`);
    for (let writtenCount = 1;writtenCount <= sources.length; writtenCount++) {
      await writeToOpenedFileFolder(state.openedFileHandle.name, sources[writtenCount - 1]);
      setStatus(`Writing ${writtenCount}/${sources.length} paths`);
    }
  }
  setStatus(`Wrote ${sources.length} paths`);
}
document.getElementById("exportAllPathsBtn").addEventListener("click", writeAllPaths);

// editor-commit.ts
async function commitNewStaticAfter(sourceId, graph) {
  const staticId = nextEditorId("B_NEW", graph);
  const source = `${replaceOutgoing(sourceId, staticId, graph)}
  ${staticId}["New static block"]`;
  await applyEditorSource(source);
  state.focusDestinationAfterTextId = staticId;
  selectEditorNode(staticId);
  focusInspectorText();
}
async function commitInsertStaticAfter(sourceId, graph) {
  const staticId = nextEditorId("B_NEW", graph);
  const oldDestination = outgoingDestination(sourceId, graph);
  const newLines = [`  ${staticId}["New static block"]`];
  if (oldDestination)
    newLines.push(`  ${staticId} --> ${oldDestination}`);
  const source = `${replaceOutgoing(sourceId, staticId, graph)}
${newLines.join(`
`)}`;
  await applyEditorSource(source);
  state.focusDestinationAfterTextId = staticId;
  selectEditorNode(staticId);
  focusInspectorText();
}
async function commitInsertDecisionAfter(sourceId, graph) {
  const removedLineIndexes = new Set;
  const successors = [];
  for (const edge of graph.edges) {
    if (edge.from !== sourceId)
      continue;
    successors.push(edge);
    removedLineIndexes.add(edge.lineIndex);
  }
  const decisionId = nextEditorId("Q_NEW", graph);
  const yesId = choiceId(decisionId, "Y");
  const noId = choiceId(decisionId, "N");
  const newLines = [
    `  ${decisionId}{"New Decision"}`,
    `  ${yesId}["Yes"]`,
    `  ${noId}["No"]`,
    `  ${sourceId} --> ${decisionId}`,
    `  ${decisionId} --> ${yesId}`,
    `  ${decisionId} --> ${noId}`
  ];
  const restoredInlineDecls = new Set;
  const restoreInlineDecl = (edge, endpointId) => {
    const node = graph.nodes.get(endpointId);
    if (node && node.lineIndex === edge.lineIndex && !restoredInlineDecls.has(endpointId)) {
      restoredInlineDecls.add(endpointId);
      newLines.push(`  ${endpointId}${declarationSuffixOf(node)}`);
    }
  };
  for (const edge of successors) {
    restoreInlineDecl(edge, edge.to);
    newLines.push(`  ${yesId} --> ${edge.to}`);
  }
  for (const edge of graph.edges) {
    if (!removedLineIndexes.has(edge.lineIndex) || edge.from === sourceId)
      continue;
    restoreInlineDecl(edge, edge.from);
    restoreInlineDecl(edge, edge.to);
    newLines.push(edge.label ? `  ${edge.from} -- "${edge.label}" --> ${edge.to}` : `  ${edge.from} --> ${edge.to}`);
  }
  await applyEditorSource(sourceWithLinesReplaced(graph, removedLineIndexes, newLines));
  selectEditorNode(decisionId);
  focusInspectorText();
}
async function commitNewDecisionAfter(sourceId, graph) {
  await commitInsertDecisionAfter(sourceId, graph);
}
async function commitAddChoiceOnDecision(questionId, graph) {
  const removedLineIndexes = new Set;
  let suffix = "NEW";
  let n = 1;
  while (graph.nodes.has(choiceId(questionId, suffix)))
    suffix = "NEW" + ++n;
  const cid = choiceId(questionId, suffix);
  const newLines = [`  ${cid}["New choice"]`, `  ${questionId} --> ${cid}`];
  await applyEditorSource(sourceWithLinesReplaced(graph, removedLineIndexes, newLines));
  selectEditorNode(questionId);
}
function addChoiceOnDecision() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = editorGraph();
  const questionId = state.selectedEditorNodeId;
  setEditorActionPromise(commitAddChoiceOnDecision(questionId, graph));
}
function commitNodeText(id = state.selectedEditorNodeId, text = nodeTextInput.value.trim()) {
  if (!id)
    return;
  const advance = state.advanceAfterDecisionText?.decisionId === id ? state.advanceAfterDecisionText : null;
  const focusDestination = state.focusDestinationAfterTextId === id;
  if (advance)
    state.advanceAfterDecisionText = null;
  if (focusDestination)
    state.focusDestinationAfterTextId = null;
  appendEditorAction(async () => {
    const graph = editorGraph();
    const node = graph.nodes.get(id);
    if (!node)
      return;
    if (node.label !== text) {
      const newToken = node.kind === "question" ? `${id}{"${text}"}` : `${id}["${text}"]`;
      const lines = graph.lines.slice();
      lines[node.lineIndex] = replaceDeclarationInLine(lines[node.lineIndex], id, newToken);
      await applyEditorSource(lines.join(`
`));
    }
    if (advance) {
      selectEditorNode(advance.choiceId);
      focusInspectorDestination();
    } else if (focusDestination) {
      selectEditorNode(id);
      focusInspectorDestination();
    }
  });
}
function applyDestination(destination) {
  const id = state.selectedEditorNodeId;
  if (!id)
    return;
  const graph = editorGraph();
  const node = graph.nodes.get(id);
  if (!node || node.kind === "question")
    return;
  const createsStatic = destination === NEW_STATIC_DESTINATION;
  const createsDecision = destination === NEW_DECISION_DESTINATION;
  if (!createsStatic && !createsDecision && outgoingDestination(id, graph) === (destination || undefined))
    return;
  const text = nodeTextInput.value.trim();
  if (text !== node.label)
    commitNodeText(id, text);
  appendEditorAction(async () => {
    const currentGraph = editorGraph();
    if (createsStatic)
      await commitNewStaticAfter(id, currentGraph);
    else if (createsDecision)
      await commitNewDecisionAfter(id, currentGraph);
    else {
      const source = destination ? replaceOutgoing(id, destination, currentGraph) : removeOutgoing(id, currentGraph);
      await applyEditorSource(source);
    }
    centerNodeInViewport(outputBox, diagramBox, id);
  });
}
function commitDestination() {
  applyDestination(destinationSelect.value);
}

// editor-inspector-events.ts
function openNodeTextEditor(event) {
  const nodeEl = event.target.closest("g.node");
  if (!nodeEl)
    return;
  selectEditorNode(nodeIdOf(nodeEl));
  nodeTextInput.focus();
  nodeTextInput.select();
}
outputBox.addEventListener("dblclick", openNodeTextEditor);
document.getElementById("addQuestionAfterBtn").addEventListener("click", addQuestionAfter);
document.getElementById("addBlockAfterBtn").addEventListener("click", addBlockAfter);
document.getElementById("removeQuestionBtn").addEventListener("click", removeQuestion);
document.getElementById("removeBlockBtn").addEventListener("click", removeBlock);
document.getElementById("addChoiceBtn").addEventListener("click", addChoice);
document.getElementById("removeChoiceBtn").addEventListener("click", removeChoice);
document.getElementById("nextRemovalPathBtn").addEventListener("click", advanceRemovalPreview);
document.getElementById("confirmRemoveQuestionBtn").addEventListener("click", confirmQuestionRemoval);
document.getElementById("cancelRemoveQuestionBtn").addEventListener("click", cancelQuestionRemoval);
document.getElementById("editorUndoBtn").addEventListener("click", undoEditorAction);
document.getElementById("editorRedoBtn").addEventListener("click", redoEditorAction);
function clearEditorSelection() {
  selectEditorNode(null);
}
document.getElementById("nodeInspectorDismissBtn").addEventListener("click", clearEditorSelection);
destinationSelect.addEventListener("change", commitDestination);
function dispatchInspectorAction(event) {
  const button = event.target.closest("button[data-action]");
  const action = button?.dataset.action;
  if (action === "add-static-after")
    applyDestination(NEW_STATIC_DESTINATION);
  else if (action === "insert-static-after") {
    if (!state.selectedEditorNodeId)
      return;
    setEditorActionPromise(commitInsertStaticAfter(state.selectedEditorNodeId, editorGraph()));
  } else if (action === "insert-decision-after") {
    if (!state.selectedEditorNodeId)
      return;
    setEditorActionPromise(commitInsertDecisionAfter(state.selectedEditorNodeId, editorGraph()));
  } else if (action === "add-decision-after")
    applyDestination(NEW_DECISION_DESTINATION);
  else if (action === "add-choice")
    addChoiceOnDecision();
  else if (action === "remove") {
    const kind = editorGraph().nodes.get(state.selectedEditorNodeId ?? "")?.kind;
    if (kind === "question")
      removeQuestion();
    else if (kind === "block")
      removeBlock();
    else if (kind === "choice")
      removeChoice();
  } else if (action === "remove-choices")
    removeChoices();
  else if (action === "insert-static-before")
    insertStaticBefore();
  else if (action === "insert-decision-before")
    insertDecisionBefore();
}
nodeInspectorActions.addEventListener("click", dispatchInspectorAction);
function writeNodeTextOnCommitKey(event) {
  const isEnter = event.key === "Enter";
  const isTab = event.key === "Tab";
  const isCommitKey = isEnter || isTab;
  if (!isCommitKey)
    return;
  event.preventDefault();
  commitNodeText();
}
nodeTextInput.addEventListener("keydown", writeNodeTextOnCommitKey);
var isPointerPressed = false;
function markPointerPressed() {
  isPointerPressed = true;
}
function clearPointerPressed() {
  isPointerPressed = false;
}
document.addEventListener("pointerdown", markPointerPressed, true);
document.addEventListener("pointerup", clearPointerPressed, true);
function writeNodeTextOnChange() {
  state.advanceAfterDecisionText = null;
  state.focusDestinationAfterTextId = null;
  const id = state.selectedEditorNodeId;
  const text = nodeTextInput.value.trim();
  if (!isPointerPressed) {
    commitNodeText(id, text);
    return;
  }
  function writeNodeTextLater() {
    commitNodeText(id, text);
  }
  function scheduleCommitAfterClick() {
    setTimeout(writeNodeTextLater);
  }
  document.addEventListener("pointerup", scheduleCommitAfterClick, { once: true });
}
nodeTextInput.addEventListener("change", writeNodeTextOnChange);
function clearSelectionOnEscape(event) {
  if (event.key !== "Escape")
    return;
  selectEditorNode(null);
}
document.addEventListener("keydown", clearSelectionOnEscape);
outputBox.addEventListener("scroll", positionNodeInspector);
window.addEventListener("resize", positionNodeInspector);

// editor-class-events.ts
classPickerBtn.addEventListener("click", () => {
  classPickerList.hidden = !classPickerList.hidden;
});
document.addEventListener("click", (event) => {
  const insidePicker = event.target.closest("#classPicker");
  if (!insidePicker)
    classPickerList.hidden = true;
});
classPickerList.addEventListener("click", (event) => {
  const button = event.target.closest("button.class-picker-row");
  if (!button)
    return;
  const nodeId = classPickerBtn.dataset.nodeId;
  classPickerList.hidden = true;
  if (button.dataset.className)
    setEditorActionPromise(assignClass(nodeId, button.dataset.className));
  else if (button.dataset.classNone !== undefined)
    setEditorActionPromise(assignClass(nodeId, null));
  else if (button.dataset.classNew !== undefined)
    openClassEditor(nodeId);
});
var classEditorAssignNodeId = null;
function openClassEditor(assignToNodeId) {
  classEditorAssignNodeId = assignToNodeId;
  classEditorName.value = "";
  classEditorFill.value = "#ffffff";
  classEditorStroke.value = "#000000";
  classEditorError.textContent = "";
  classEditorDialog.showModal();
}
classEditorCancelBtn.addEventListener("click", () => classEditorDialog.close());
classEditorCreateBtn.addEventListener("click", () => {
  const name = classEditorName.value.trim();
  if (!name) {
    classEditorError.textContent = "Name is required.";
    return;
  }
  const existingClassDef = classDefByName(codeBox.value, name);
  if (existingClassDef) {
    classEditorError.textContent = `Class "${name}" already exists.`;
    return;
  }
  classEditorError.textContent = "";
  const assignToNodeId = classEditorAssignNodeId;
  setEditorActionPromise((async () => {
    await createClass(name, classEditorFill.value, classEditorStroke.value);
    if (assignToNodeId)
      await assignClass(assignToNodeId, name);
    if (classesDialog.open)
      renderClassesDialog();
  })());
  classEditorDialog.close();
});
function renderClassesDialog() {
  const defs = parseClassDefs(codeBox.value);
  const rowHtmlParts = [];
  for (const def of defs) {
    rowHtmlParts.push(`
    <div class="classes-row" data-class-name="${def.name}">
      <input type="color" class="classes-fill" value="${def.fill}">
      <input type="color" class="classes-stroke" value="${def.stroke}">
      <input type="text" class="classes-name" value="${def.name}">
      <button type="button" class="classes-delete">Delete</button>
    </div>`);
  }
  classesList.innerHTML = rowHtmlParts.join("");
  classesError.textContent = "";
}
classesMenuBtn.addEventListener("click", () => {
  document.getElementById("fileMenu").removeAttribute("open");
  renderClassesDialog();
  classesDialog.showModal();
});
classesCloseBtn.addEventListener("click", () => classesDialog.close());
classesNewBtn.addEventListener("click", () => openClassEditor(null));
classesList.addEventListener("change", (event) => {
  const row = event.target.closest(".classes-row");
  if (!row)
    return;
  const name = row.dataset.className;
  const target = event.target;
  const isFillInput = target.classList.contains("classes-fill");
  const isStrokeInput = target.classList.contains("classes-stroke");
  const isNameInput = target.classList.contains("classes-name");
  const isColorInput = isFillInput ? true : isStrokeInput;
  if (isColorInput) {
    const fill = row.querySelector(".classes-fill").value;
    const stroke = row.querySelector(".classes-stroke").value;
    setEditorActionPromise(setClassColors(name, fill, stroke).then(renderClassesDialog));
  } else if (isNameInput) {
    const newName = target.value.trim();
    const isNameBlank = !newName;
    const isNameUnchanged = newName === name;
    const isNameUnusable = isNameBlank ? true : isNameUnchanged;
    if (isNameUnusable) {
      target.value = name;
      return;
    }
    let isNameTaken = false;
    for (const def of parseClassDefs(codeBox.value)) {
      const isSameName = def.name === newName;
      if (isSameName)
        isNameTaken = true;
    }
    if (isNameTaken) {
      classesError.textContent = `Class "${newName}" already exists.`;
      target.value = name;
      return;
    }
    setEditorActionPromise(renameClass(name, newName).then(renderClassesDialog));
  }
});
classesList.addEventListener("click", (event) => {
  const button = event.target.closest(".classes-delete");
  if (!button)
    return;
  const name = button.closest(".classes-row").dataset.className;
  setEditorActionPromise(deleteClass(name).then(renderClassesDialog));
});

// editor-events.ts
function selectNodeSourceLine(id) {
  const lines = codeBox.value.split(`
`);
  let start = 0;
  for (let i = 0;i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const startsWithId = trimmed.startsWith(id);
    const isNodeDefinition = startsWithId && ["[", "{", "("].includes(trimmed.charAt(id.length));
    if (isNodeDefinition) {
      codeBox.focus({ preventScroll: true });
      codeBox.setSelectionRange(start, start + lines[i].length);
      codeBox.blur();
      return;
    }
    start += lines[i].length + 1;
  }
}
var selectClickedNode = (event) => {
  const nodeEl = event.target.closest("g.node");
  const id = nodeEl ? nodeIdOf(nodeEl) : null;
  if (id)
    selectNodeSourceLine(id);
  selectEditorNode(id);
  if (id) {
    const graph = editorGraph();
    const node = graph.nodes.get(id);
    if (node?.kind === "question") {
      state.phoneFocusNodeId = id;
      state.phoneFocusUsesDecisionContext = true;
      state.phonePreviewChoiceId = null;
      render();
    } else {
      const feedingChoice = nearestFeedingChoice(id, graph);
      if (feedingChoice) {
        state.phoneFocusNodeId = null;
        state.phoneFocusUsesDecisionContext = false;
        state.phonePreviewChoiceId = feedingChoice;
        render();
      }
    }
  }
};
outputBox.addEventListener("click", selectClickedNode);
var selectPhoneChoice = async (event) => {
  const target = event.target.closest("button[data-choose], button[data-revert], button[data-undo], button[data-reset-decisions], button[data-write-path]");
  if (!target)
    return;
  const isWritePath = target.dataset.writePath !== undefined;
  if (isWritePath) {
    await writeChosenPath();
    return;
  }
  const isResetDecisions = target.dataset.resetDecisions !== undefined;
  if (isResetDecisions) {
    document.getElementById("resetBtn").click();
    return;
  }
  const isUndo = target.dataset.undo !== undefined;
  if (isUndo) {
    phonePath.pop();
  } else if (target.dataset.choose) {
    const choiceId = target.dataset.choose;
    const isShowingHistory = isPhoneShowingHistory();
    if (!isShowingHistory) {
      const edges = parseEdges(codeBox.value);
      const answers = findAnswersLeadingTo(parentOf(choiceId, edges), edges, editorGraph());
      phonePath.length = 0;
      phonePath.push(...answers);
    }
    phonePath.push(choiceId);
  } else {
    const [indexStr, choiceId] = target.dataset.revert.split(":");
    phonePath.length = Number(indexStr);
    phonePath.push(choiceId);
  }
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  await render();
  if (state.currentBottomQ) {
    state.currentDecisionId = state.currentBottomQ;
    selectEditorNode(state.currentBottomQ);
    const node = diagramBox.querySelector('[id*="flowchart-' + state.currentBottomQ + '-"]');
    const outputRect = outputBox.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    outputBox.scrollBy({
      left: nodeRect.left + nodeRect.width / 2 - outputRect.left - outputBox.clientWidth / 2,
      top: nodeRect.top + nodeRect.height / 2 - outputRect.top - outputBox.clientHeight / 2,
      behavior: "smooth"
    });
  }
};
phoneDiagramBox.addEventListener("click", selectPhoneChoice);

// open-file.ts
async function openFileFromDialog() {
  const openResponse = await fetch("/api/open-file");
  if (openResponse.status === 204) {
    console.log("User canceled Open File");
    return;
  }
  const { path, text } = await openResponse.json();
  if (state.watcher)
    state.watcher.close();
  state.currentName = null;
  state.openedFileHandle = null;
  state.loadedPath = path;
  statusBox.textContent = path;
  state.pathFolderHandle = null;
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  state.diagramScale = null;
  state.currentDecisionId = null;
  codeBox.value = text;
  restoreTypeMetadata(splitEditorMetadata(codeBox.value).metadata);
  resetEditorHistory(codeBox.value);
  selectBox.value = "";
  render();
  loadList();
  setDrawerOpen(true);
}

// node-search.ts
var searchMatches = [];
var searchIndex = 0;
var searchRunId = 0;
function matchingNodes(graph, query) {
  if (query === "")
    return [];
  const needle = query.toLowerCase();
  return [...graph.nodes.values()].filter((node) => node.id.toLowerCase().includes(needle) || node.label.toLowerCase().includes(needle)).sort((a, b) => a.lineIndex - b.lineIndex);
}
function updateSearchControls() {
  const hasText = searchInput.value !== "";
  const hasSeveralMatches = searchMatches.length > 1;
  const current = searchMatches.length === 0 ? 0 : searchIndex + 1;
  searchClearBtn.hidden = !hasText;
  searchCounter.hidden = !hasText;
  searchPreviousBtn.hidden = !hasSeveralMatches;
  searchNextBtn.hidden = !hasSeveralMatches;
  searchCounter.textContent = `${current} / ${searchMatches.length}`;
}
async function jumpToSearchMatch() {
  const runId = ++searchRunId;
  const id = searchMatches[searchIndex].id;
  selectEditorNode(id);
  await render();
  if (runId !== searchRunId)
    return;
  selectEditorNode(id);
  centerNodeInViewport(outputBox, diagramBox, id);
}
async function runSearch() {
  let graph;
  try {
    graph = editorGraph();
  } catch (error) {
    showEditorValidationError(error);
    return;
  }
  searchMatches = matchingNodes(graph, searchInput.value);
  searchIndex = 0;
  updateSearchControls();
  if (searchMatches.length === 0)
    return;
  await jumpToSearchMatch();
}
async function cycleSearch(step) {
  searchIndex = (searchIndex + step + searchMatches.length) % searchMatches.length;
  updateSearchControls();
  await jumpToSearchMatch();
}
function clearSearch() {
  searchInput.value = "";
  searchMatches = [];
  searchIndex = 0;
  searchRunId++;
  updateSearchControls();
}

// main-events.ts
function resetEditorToNewDiagram() {
  if (state.watcher)
    state.watcher.close();
  state.currentName = null;
  state.openedFileHandle = null;
  state.loadedPath = null;
  statusBox.textContent = "";
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  state.diagramScale = null;
  state.currentDecisionId = null;
  restoreTypeMetadata(null);
  codeBox.value = `flowchart TD
  B_NEW[New idea]`;
  resetEditorHistory(codeBox.value);
  render();
  loadList();
  setDrawerOpen(true);
}
function selectPreviousDecision() {
  navigateDecision(-1);
}
function selectNextDecision() {
  navigateDecision(1);
}
function selectPreviousSearchMatch() {
  cycleSearch(-1);
}
function selectNextSearchMatch() {
  cycleSearch(1);
}
function applyZoomIn() {
  setMainZoomPercent(state.mainZoomPercent + MAIN_ZOOM_STEP);
}
function applyZoomOut() {
  setMainZoomPercent(state.mainZoomPercent - MAIN_ZOOM_STEP);
}
function resetZoom() {
  setMainZoomPercent(100);
}
function resetChosenPath() {
  chosenAnswers.clear();
  phonePath.length = 0;
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  highlightPath();
  render();
  outputBox.scrollTo({ top: 0, behavior: "smooth" });
  phoneDiagramBox.querySelector("#phoneHistory")?.scrollTo({ top: 0, behavior: "smooth" });
}
function toggleDrawer() {
  setDrawerOpen(drawer.classList.contains("closed"));
}
function loadSelectedDiagram() {
  loadDiagram(selectBox.value);
}
function renderCodeBoxEdit() {
  resetEditorHistory(codeBox.value);
  render();
}
function closeFileMenu() {
  document.getElementById("fileMenu").open = false;
}
document.getElementById("newBtn").addEventListener("click", resetEditorToNewDiagram);
document.getElementById("saveBtn").addEventListener("click", saveDiagram);
previousDecisionBtn.addEventListener("click", selectPreviousDecision);
nextDecisionBtn.addEventListener("click", selectNextDecision);
searchInput.addEventListener("input", runSearch);
searchClearBtn.addEventListener("click", clearSearch);
searchPreviousBtn.addEventListener("click", selectPreviousSearchMatch);
searchNextBtn.addEventListener("click", selectNextSearchMatch);
zoomInBtn.addEventListener("click", applyZoomIn);
zoomOutBtn.addEventListener("click", applyZoomOut);
zoomResetBtn.addEventListener("click", resetZoom);
document.getElementById("resetBtn").addEventListener("click", resetChosenPath);
drawerToggle.addEventListener("click", toggleDrawer);
selectBox.addEventListener("change", loadSelectedDiagram);
openFileBtn.addEventListener("click", openFileFromDialog);
codeBox.addEventListener("input", renderCodeBoxEdit);
document.getElementById("fileMenuItems").addEventListener("click", closeFileMenu);

// viewer.ts
applyMainZoom(false);
loadDiagram(sessionStorage.getItem("loadedDiagram") ?? "accountability.mmd");
Object.assign(window, { loadDiagram, codeBox, nodeIdOf, selectEditorNode, addQuestionAfter, addBlockAfter, removeQuestion, removeBlock, addChoice, removeChoice, removeChoices, undoEditorAction, redoEditorAction, insertStaticBefore, insertDecisionBefore, listAllPathIds });
