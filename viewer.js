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
function findTrail(edges) {
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
      const isChosen = chosenAnswers.has(option);
      if (isChosen) {
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
function applyPathHighlight() {
  const svgNodes = diagramBox.querySelectorAll("g.node");
  const svgEdges = diagramBox.querySelectorAll("path.flowchart-link");
  const edges = parseEdges(codeBox.value);
  const bright = chosenAnswers.size ? findTrail(edges) : null;
  const isDim = (id) => bright !== null && !bright.has(id);
  for (const el of svgNodes)
    el.classList.toggle("dim", isDim(getNodeId(el)));
  for (const el of svgEdges) {
    const [from, to] = getEdgeEnds(el, edges);
    el.classList.toggle("dim", isDim(from) || isDim(to));
  }
}
function getEdgeEnds(el, edges) {
  let found;
  for (const edge of edges) {
    const isEdgeElement = el.id.includes("L_" + edge[0] + "_" + edge[1] + "_");
    if (isEdgeElement) {
      found = edge;
      break;
    }
  }
  return found || [];
}
function getNodeId(el) {
  return el.id.replace(/^.*flowchart-/, "").replace(/-\d+$/, "");
}
function reportEditorValidationError(error) {
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

// editor-metadata.ts
function splitEditorMetadata(source) {
  const headerPattern = /(?:^|\r?\n)%%%%====\r?\n%% DO NOT MODIFY - AUTOMATICALLY GENERATED DURING EVERY SAVE\r?\n%% (\{[^\r\n]*\})\r?\n%%%%====/g;
  const matches = [...source.matchAll(headerPattern)];
  if (matches.length === 0)
    return { source, metadata: null };
  let metadata = null;
  try {
    const parsed = JSON.parse(matches[matches.length - 1][1]);
    const isObject = typeof parsed === "object";
    const hasParsed = !!parsed;
    const isRecord = hasParsed && isObject;
    if (isRecord) {
      const lastSelectedNodeId = typeof parsed.lastSelectedNodeId === "string" || parsed.lastSelectedNodeId === null ? parsed.lastSelectedNodeId : null;
      metadata = {
        lastSelectedNodeId,
        outputScrollLeft: typeof parsed.outputScrollLeft === "number" ? parsed.outputScrollLeft : undefined,
        outputScrollTop: typeof parsed.outputScrollTop === "number" ? parsed.outputScrollTop : undefined,
        mainZoomPercent: typeof parsed.mainZoomPercent === "number" ? parsed.mainZoomPercent : undefined,
        typeColors: getStringRecord(parsed.typeColors),
        nodeTypes: getStringRecord(parsed.nodeTypes)
      };
    }
  } catch {}
  return { source: source.replace(headerPattern, "").replace(/\s+$/, ""), metadata };
}
function buildSourceWithMetadata(source) {
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
function getStringRecord(value) {
  const isMissing = !value;
  const isNotObject = typeof value !== "object";
  const isMissingOrNotObject = isMissing || isNotObject;
  const isArray = Array.isArray(value);
  const isInvalid = isMissingOrNotObject || isArray;
  if (isInvalid)
    return;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string")
      result[key] = entry;
  }
  return result;
}
function applyTypeMetadata(metadata) {}
function setEditorActionPromise(promise) {
  state.editorActionPromise = promise;
  window.editorActionPromise = promise;
}
setEditorActionPromise(Promise.resolve());

// editor-parse.ts
function trimEditorQuotes(text) {
  return text.replace(/^"(.*)"$/, "$1");
}
function parseEditorToken(token) {
  const match = token.match(/^([A-Za-z0-9_]+)([\s\S]*)$/);
  if (!match)
    return { id: token, shape: null, label: "" };
  const id = match[1];
  const rest = match[2].trim();
  const startsBrace = rest.startsWith("{");
  const endsBrace = rest.endsWith("}");
  const isBrace = startsBrace && endsBrace;
  if (isBrace)
    return { id, shape: "brace", label: trimEditorQuotes(rest.slice(1, -1)) };
  const startsRound = rest.startsWith("([");
  const endsRound = rest.endsWith("])");
  const isRound = startsRound && endsRound;
  if (isRound)
    return { id, shape: "other", label: trimEditorQuotes(rest.slice(2, -2)) };
  const startsBracket = rest.startsWith("[");
  const endsBracket = rest.endsWith("]");
  const isBracket = startsBracket && endsBracket;
  if (isBracket)
    return { id, shape: "rect", label: trimEditorQuotes(rest.slice(1, -1)) };
  return { id, shape: null, label: "" };
}
function getDeclarationRequirement(id) {
  const isChoice = id.startsWith("Q_CHOICE");
  if (isChoice)
    return 'start with "Q_CHOICE" and use bracket shape []';
  const isQuestion = id.startsWith("Q_");
  if (isQuestion)
    return 'start with "Q_" and use brace shape {}';
  const isBlock = id.startsWith("B_");
  if (isBlock)
    return 'start with "B_" and use bracket shape []';
  return 'use "Q_" with brace shape {} for a decision, "Q_CHOICE" with bracket shape [] for a choice, or "B_" with bracket shape [] for a static block';
}
function validateDeclaration(id, shape, lineNumber, problems) {
  const subject = `Line ${lineNumber}: id "${id}"`;
  if (shape === "other") {
    problems.push(`${subject} uses unsupported rounded/stadium shape; it must ${getDeclarationRequirement(id)}.`);
    return;
  }
  const isChoice = id.startsWith("Q_CHOICE");
  if (isChoice) {
    if (shape !== "rect")
      problems.push(`${subject} is a choice and must use bracket shape [] (for example, ${id}["Choice"]).`);
    return;
  }
  const isQuestion = id.startsWith("Q_");
  if (isQuestion) {
    if (shape !== "brace")
      problems.push(`${subject} is a decision and must use brace shape {} (for example, ${id}{"Decision"}).`);
    return;
  }
  const isBlock = id.startsWith("B_");
  if (isBlock) {
    if (shape !== "rect")
      problems.push(`${subject} is a static block and must use bracket shape [] (for example, ${id}["Block"]).`);
    return;
  }
  problems.push(`${subject} has a non-compliant prefix; it must ${getDeclarationRequirement(id)}.`);
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
  let hasEmptyToken = false;
  for (const token of tokens) {
    const isEmpty = !token;
    if (isEmpty) {
      hasEmptyToken = true;
      break;
    }
  }
  if (hasEmptyToken)
    return null;
  const segments = [];
  for (let index = 0;index < tokens.length - 1; index++)
    segments.push({ fromToken: tokens[index], label: labels[index], toToken: tokens[index + 1] });
  return segments;
}
function getDeclarationSuffix(node) {
  if (node.kind === "question")
    return `{"${node.label}"}`;
  if (node.kind === "choice")
    return `["${node.label}"]`;
  return `["${node.label}"]`;
}

// editor-graph.ts
function storeDeclaration(declLines, token, lineIndex) {
  const isDeclaration = !!token.shape;
  const isNew = !declLines.has(token.id);
  const shouldStore = isDeclaration && isNew;
  if (shouldStore)
    declLines.set(token.id, { shape: token.shape, label: token.label, lineIndex });
}
function getEditorGraph() {
  const lines = codeBox.value.split(`
`);
  const declLines = new Map;
  const edges = [];
  const references = new Map;
  const problems = [];
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
        storeDeclaration(declLines, decl, lineIndex);
        validateDeclaration(decl.id, decl.shape, lineIndex + 1, problems);
      }
    }
  }
  for (const [id, lineIndex] of references) {
    const isUndeclared = !declLines.has(id);
    if (isUndeclared)
      problems.push(`Line ${lineIndex + 1}: id "${id}" must be declared on its own standalone line and ${getDeclarationRequirement(id)}.`);
  }
  const uniqueProblems = [...new Set(problems)];
  if (uniqueProblems.length) {
    const error = new EditorValidationError(uniqueProblems);
    reportEditorValidationError(error);
    throw error;
  }
  const nodes = new Map;
  for (const [id, decl] of declLines) {
    const kind = id.startsWith("Q_CHOICE") ? "choice" : id.startsWith("Q_") ? "question" : "block";
    nodes.set(id, { id, kind, label: decl.label, lineIndex: decl.lineIndex });
  }
  return { lines, nodes, edges };
}

// node-inspector-focus.ts
function updateNodeInspectorPosition() {}
function setInspectorTextFocus() {
  nodeTextInput.focus();
  nodeTextInput.select();
}
function setInspectorDestinationFocus() {
  destinationSelect.focus();
}
function clearInspectorFocus() {
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
  updateNodeInspectorPosition();
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

// decision-search.ts
function findNearestFeedingChoice(id, graph) {
  const visited = new Set([id]);
  let frontier = [id];
  while (frontier.length) {
    const nextFrontier = [];
    for (const nodeId of frontier) {
      const node = graph.nodes.get(nodeId);
      const isChoice = node?.kind === "choice";
      const isQuestion = node?.kind === "question";
      const isAnswerKind = isChoice || isQuestion;
      let isFedByDecision = false;
      for (const edge of graph.edges) {
        const targetsNode = edge.to === nodeId;
        const isFromDecision = graph.nodes.get(edge.from)?.kind === "question";
        const isFeeder = targetsNode && isFromDecision;
        if (isFeeder) {
          isFedByDecision = true;
          break;
        }
      }
      const isChoiceFedByDecision = isAnswerKind && isFedByDecision;
      if (isChoiceFedByDecision)
        return nodeId;
      for (const edge of graph.edges) {
        const isOtherNode = edge.to !== nodeId;
        const isVisited = visited.has(edge.from);
        const shouldSkip = isOtherNode || isVisited;
        if (shouldSkip)
          continue;
        visited.add(edge.from);
        nextFrontier.push(edge.from);
      }
    }
    frontier = nextFrontier;
  }
  return null;
}

// decision-nav.ts
function compareLineIndex(a, b) {
  return a.lineIndex - b.lineIndex;
}
function listDecisionNodes(graph) {
  const decisions = [];
  for (const node of graph.nodes.values()) {
    const isQuestion = node.kind === "question";
    if (isQuestion)
      decisions.push(node);
  }
  decisions.sort(compareLineIndex);
  return decisions;
}
function clearInvalidPhonePreview(graph) {
  const hasFocus = !!state.phoneFocusNodeId;
  const isFocusNotQuestion = graph.nodes.get(state.phoneFocusNodeId ?? "")?.kind !== "question";
  const isFocusInvalid = hasFocus && isFocusNotQuestion;
  if (isFocusInvalid) {
    state.phoneFocusNodeId = null;
    state.phoneFocusUsesDecisionContext = false;
  }
  const hasPreview = !!state.phonePreviewChoiceId;
  if (!hasPreview)
    return;
  const feedingChoice = findNearestFeedingChoice(state.phonePreviewChoiceId, graph);
  const isPreviewInvalid = feedingChoice !== state.phonePreviewChoiceId;
  if (isPreviewInvalid)
    state.phonePreviewChoiceId = null;
}
function updateDecisionCounter(graph) {
  const decisions = listDecisionNodes(graph);
  if (decisions.length === 0) {
    state.currentDecisionId = null;
    decisionCounter.textContent = "0 / 0";
    return decisions;
  }
  let hasCurrentDecision = false;
  for (const node of decisions) {
    const isCurrent = node.id === state.currentDecisionId;
    if (isCurrent) {
      hasCurrentDecision = true;
      break;
    }
  }
  if (!hasCurrentDecision) {
    let selectedDecisionId;
    for (const node of decisions) {
      const isSelected = node.id === state.selectedEditorNodeId;
      if (isSelected) {
        selectedDecisionId = node.id;
        break;
      }
    }
    state.currentDecisionId = selectedDecisionId ?? decisions[0].id;
  }
  let current = 0;
  for (let i = 0;i < decisions.length; i++) {
    const isCurrent = decisions[i].id === state.currentDecisionId;
    if (isCurrent) {
      current = i + 1;
      break;
    }
  }
  decisionCounter.textContent = `${current} / ${decisions.length}`;
  return decisions;
}
function moveNodeToViewportCenter(container, diagram, id) {
  const node = diagram.querySelector('[id*="flowchart-' + id + '-"]');
  if (!node)
    return;
  const containerRect = container.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  container.scrollLeft += nodeRect.left + nodeRect.width / 2 - containerRect.left - container.clientWidth / 2;
  container.scrollTop += nodeRect.top + nodeRect.height / 2 - containerRect.top - container.clientHeight / 2;
}
async function moveToDecision(step) {
  let graph;
  try {
    graph = getEditorGraph();
  } catch (error) {
    reportEditorValidationError(error);
    return;
  }
  const decisions = updateDecisionCounter(graph);
  if (decisions.length === 0) {
    setStatus("No decisions in this diagram");
    return;
  }
  const selected = graph.nodes.get(state.selectedEditorNodeId ?? "");
  const anchorId = selected?.kind === "question" ? selected.id : state.currentDecisionId;
  let currentIndex = -1;
  for (let i = 0;i < decisions.length; i++) {
    const isAnchor = decisions[i].id === anchorId;
    if (isAnchor) {
      currentIndex = i;
      break;
    }
  }
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
  moveNodeToViewportCenter(outputBox, diagramBox, decision.id);
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

// class-lines.ts
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
function buildStyleText(order, props) {
  const parts = [];
  for (const key of order)
    parts.push(`${key}:${props[key]}`);
  return parts.join(",");
}
function parseClassDefs(source) {
  const defs = [];
  const lines = source.split(`
`);
  for (let i = 0;i < lines.length; i++) {
    const isLineCommented = isCommented(lines[i]);
    if (isLineCommented)
      continue;
    const match = lines[i].match(CLASSDEF_LINE_RE);
    if (!match)
      continue;
    const { props } = parseStyleProps(match[3]);
    defs.push({ name: match[2], fill: props.fill ?? "", stroke: props.stroke ?? "", lineIndex: i });
  }
  return defs;
}
function findClassDef(source, name) {
  for (const def of parseClassDefs(source)) {
    const isNamedClass = def.name === name;
    if (isNamedClass)
      return def;
  }
  return;
}
function findClassOfNode(source, nodeId) {
  let found = null;
  for (const line of source.split(`
`)) {
    const isLineCommented = isCommented(line);
    if (isLineCommented)
      continue;
    const match = line.match(CLASS_LINE_RE);
    if (!match)
      continue;
    const ids = match[2].split(",");
    const listsNode = ids.includes(nodeId);
    if (listsNode)
      found = match[3];
  }
  return found;
}

// class-style-index.ts
function buildClassStyleIndex(source) {
  const assignments = new Map;
  for (const line of source.split(`
`)) {
    const isLineCommented = isCommented(line);
    if (isLineCommented)
      continue;
    const match = line.match(CLASS_LINE_RE);
    if (!match)
      continue;
    for (const id of match[2].split(","))
      assignments.set(id, match[3]);
  }
  const defsByName = new Map;
  for (const def of parseClassDefs(source))
    defsByName.set(def.name, def);
  return { assignments, defsByName };
}
function findNodeStyle(index, nodeId) {
  const name = index.assignments.get(nodeId);
  if (!name)
    return null;
  const def = index.defsByName.get(name);
  if (!def)
    return null;
  return { name, fill: def.fill, stroke: def.stroke };
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
    const node = graph.nodes.get(getNodeId(nodeEl));
    if (!node)
      continue;
    const isClassed = !!findNodeStyle(classIndex, node.id);
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
function compareNodesByLine(a, b) {
  return a.lineIndex - b.lineIndex;
}
function buildHistoryRows(edges, graph) {
  if (edges.length === 0) {
    const sorted = [...graph.nodes.values()].sort(compareNodesByLine);
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
  const classStyle = findNodeStyle(classIndex, node.id);
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
    const graph = getEditorGraph();
    clearInvalidPhonePreview(graph);
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
    applyPathHighlight();
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
    updateNodeInspectorPosition();
    errorLog.textContent = "";
    errorLog.classList.remove("open");
  } catch (err) {
    state.currentDecisionId = null;
    decisionCounter.textContent = "0 / 0";
    reportEditorValidationError(err);
  }
}
function applyFunctionsOnlyToggle() {
  state.functionsOnly = functionsOnlyToggle.checked;
  render();
}
function applyDarkModeToggle() {
  document.body.classList.toggle("dark", darkModeToggle.checked);
  mermaid.initialize(getMermaidOptions());
  render();
}
functionsOnlyToggle.addEventListener("change", applyFunctionsOnlyToggle);
darkModeToggle.addEventListener("change", applyDarkModeToggle);

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
      applyTypeMetadata(splitEditorMetadata(text).metadata);
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

// source-edit.ts
function buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines) {
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
function getNextEditorId(prefix, graph) {
  let n = 1;
  while (graph.nodes.has(`${prefix}_${n}`))
    n++;
  return `${prefix}_${n}`;
}
function buildChoiceId(questionId, suffix) {
  return `Q_CHOICE_${questionId.replace(/^Q_/, "")}_${suffix}`;
}
function findOutgoingDestination(id, graph) {
  for (const edge of graph.edges) {
    const isOutgoing = edge.from === id;
    if (isOutgoing)
      return edge.to;
  }
  return;
}
function buildSourceWithOutgoingChanged(id, destination, graph) {
  const removedLineIndexes = new Set;
  const restoredIds = new Set;
  const newLines = [];
  for (const edge of graph.edges) {
    if (edge.from !== id)
      continue;
    removedLineIndexes.add(edge.lineIndex);
    for (const endpointId of [edge.from, edge.to]) {
      const endpoint = graph.nodes.get(endpointId);
      const isOnEdgeLine = endpoint?.lineIndex === edge.lineIndex;
      const isNotRestored = !restoredIds.has(endpointId);
      const shouldRestore = isOnEdgeLine && isNotRestored;
      if (shouldRestore) {
        restoredIds.add(endpointId);
        newLines.push(`  ${endpointId}${getDeclarationSuffix(endpoint)}`);
      }
    }
  }
  if (destination)
    newLines.push(`  ${id} --> ${destination}`);
  return buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines);
}
function replaceOutgoing(id, destination, graph) {
  return buildSourceWithOutgoingChanged(id, destination, graph);
}
function removeOutgoing(id, graph) {
  return buildSourceWithOutgoingChanged(id, undefined, graph);
}
function appendInlineDecl(edge, keepEndpointId, graph, newLines) {
  const node = graph.nodes.get(keepEndpointId);
  const isOnEdgeLine = node?.lineIndex === edge.lineIndex;
  if (isOnEdgeLine)
    newLines.push(`  ${keepEndpointId}${getDeclarationSuffix(node)}`);
}

// node-inspector-class.ts
function renderClassPicker(node) {
  const source = codeBox.value;
  const className = findClassOfNode(source, node.id);
  const def = className ? findClassDef(source, className) : undefined;
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

// node-inspector.ts
function replaceDeclarationInLine(line, id, newToken) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escapedId}(\\{[^}]*\\}|\\[[^\\]]*\\]|\\(\\[[^\\]]*\\]\\))`);
  return line.replace(re, newToken);
}
function createInspectorActionButton(action, label, spanTwoColumns = false) {
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
    graph = getEditorGraph();
  } catch {
    nodeInspector.hidden = true;
    clearInspectorFocus();
    return;
  }
  const node = graph.nodes.get(state.selectedEditorNodeId ?? "");
  nodeInspector.hidden = !node;
  if (!node) {
    nodeTextInput.value = "";
    clearInspectorFocus();
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
    updateNodeInspectorPosition();
    return;
  }
  const actions = [createInspectorActionButton("remove", "Remove")];
  if (node.kind === "question")
    actions.push(createInspectorActionButton("add-choice", "Add choice"), createInspectorActionButton("remove-choices", "Remove choices"), createInspectorActionButton("insert-static-before", "insert static block before"), createInspectorActionButton("insert-decision-before", "insert Decision & leading choice before"));
  else if (node.kind === "block")
    actions.push(createInspectorActionButton("add-decision-after", "add Decision block after"), createInspectorActionButton("insert-decision-after", "Insert decision block after"), createInspectorActionButton("insert-static-after", "Insert static block after"), createInspectorActionButton("insert-static-before", "insert static block before"), createInspectorActionButton("insert-decision-before", "insert Decision & leading choice before"));
  else if (node.kind === "choice")
    actions.push(createInspectorActionButton("add-decision-after", "add Decision block after"), createInspectorActionButton("add-static-after", "add static block after"), createInspectorActionButton("insert-decision-after", "Insert decision block after"), createInspectorActionButton("insert-static-after", "Insert static block after"));
  nodeInspectorActions.replaceChildren(...actions);
  const hasDestination = node.kind !== "question";
  destinationRow.hidden = !hasDestination;
  destinationSelect.replaceChildren();
  if (hasDestination) {
    destinationSelect.add(new Option("Terminal", ""));
    destinationSelect.add(new Option("New static block", NEW_STATIC_DESTINATION));
    destinationSelect.add(new Option("New Decision block", NEW_DECISION_DESTINATION));
    const destination = findOutgoingDestination(node.id, graph);
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
  updateNodeInspectorPosition();
}

// editor-actions.ts
async function applyEditorSource(source, options) {
  source = buildSourceWithMetadata(source);
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
  const graph = getEditorGraph();
  const selected = state.selectedEditorNodeId;
  const removedLineIndexes = new Set;
  const successors = [];
  for (const edge of graph.edges) {
    if (edge.from !== selected)
      continue;
    successors.push(edge.to);
    removedLineIndexes.add(edge.lineIndex);
  }
  const qId = getNextEditorId("Q_NEW", graph);
  const yesId = buildChoiceId(qId, "Y");
  const noId = buildChoiceId(qId, "N");
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
    appendInlineDecl(edge, edge.to, graph, newLines);
  }
  for (const successor of successors) {
    newLines.push(`  ${yesId} --> ${successor}`);
    newLines.push(`  ${noId} --> ${successor}`);
  }
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
function addBlockAfter() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const selected = state.selectedEditorNodeId;
  const removedLineIndexes = new Set;
  const successors = [];
  const newLines = [];
  for (const edge of graph.edges) {
    if (edge.from !== selected)
      continue;
    successors.push(edge.to);
    removedLineIndexes.add(edge.lineIndex);
    appendInlineDecl(edge, edge.to, graph, newLines);
  }
  const bId = getNextEditorId("B_NEW", graph);
  newLines.unshift(`  ${selected} --> ${bId}`, `  ${bId}["New block"]`);
  for (const successor of successors)
    newLines.push(`  ${bId} --> ${successor}`);
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
function getChoiceSuffixFromLabel(label) {
  const upperLabel = label.trim().toUpperCase();
  const underscored = upperLabel.replace(/[^A-Z0-9]+/g, "_");
  const trimmed = underscored.replace(/^_+|_+$/g, "");
  return trimmed || "CHOICE";
}
function addChoice() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const questionId = state.selectedEditorNodeId;
  let labelled;
  for (const edge of graph.edges) {
    const isFromQuestion = edge.from === questionId;
    const hasLabel = !!edge.label;
    const isLabelled = isFromQuestion && hasLabel;
    if (isLabelled) {
      labelled = edge;
      break;
    }
  }
  const removedLineIndexes = new Set;
  const newLines = [];
  if (labelled) {
    removedLineIndexes.add(labelled.lineIndex);
    const suffix = getChoiceSuffixFromLabel(labelled.label);
    const cid = buildChoiceId(questionId, suffix);
    const targetNode = graph.nodes.get(labelled.to);
    const isTargetOnEdgeLine = targetNode?.lineIndex === labelled.lineIndex;
    const targetSuffix = isTargetOnEdgeLine ? getDeclarationSuffix(targetNode) : "";
    newLines.push(`  ${cid}["${labelled.label}"]`, `  ${questionId} --> ${cid}`, `  ${cid} --> ${labelled.to}${targetSuffix}`);
  } else {
    let suffix = "NEW";
    let n = 1;
    while (graph.nodes.has(buildChoiceId(questionId, suffix)))
      suffix = "NEW" + ++n;
    const cid = buildChoiceId(questionId, suffix);
    newLines.push(`  ${cid}["New choice"]`, `  ${questionId} --> ${cid}`);
  }
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}

// editor-insert-after.ts
async function createStaticAfter(sourceId, graph) {
  const staticId = getNextEditorId("B_NEW", graph);
  const source = `${replaceOutgoing(sourceId, staticId, graph)}
  ${staticId}["New static block"]`;
  await applyEditorSource(source);
  state.focusDestinationAfterTextId = staticId;
  selectEditorNode(staticId);
  setInspectorTextFocus();
}
async function insertStaticAfterNode(sourceId, graph) {
  const staticId = getNextEditorId("B_NEW", graph);
  const oldDestination = findOutgoingDestination(sourceId, graph);
  const newLines = [`  ${staticId}["New static block"]`];
  if (oldDestination)
    newLines.push(`  ${staticId} --> ${oldDestination}`);
  const source = `${replaceOutgoing(sourceId, staticId, graph)}
${newLines.join(`
`)}`;
  await applyEditorSource(source);
  state.focusDestinationAfterTextId = staticId;
  selectEditorNode(staticId);
  setInspectorTextFocus();
}
function appendInlineDeclaration(newLines, restoredIds, graph, edge, endpointId) {
  const node = graph.nodes.get(endpointId);
  const isOnEdgeLine = node?.lineIndex === edge.lineIndex;
  const isNotRestored = !restoredIds.has(endpointId);
  const shouldRestore = isOnEdgeLine && isNotRestored;
  if (shouldRestore) {
    restoredIds.add(endpointId);
    newLines.push(`  ${endpointId}${getDeclarationSuffix(node)}`);
  }
}
async function insertDecisionAfterNode(sourceId, graph) {
  const removedLineIndexes = new Set;
  const successors = [];
  for (const edge of graph.edges) {
    if (edge.from !== sourceId)
      continue;
    successors.push(edge);
    removedLineIndexes.add(edge.lineIndex);
  }
  const decisionId = getNextEditorId("Q_NEW", graph);
  const yesId = buildChoiceId(decisionId, "Y");
  const noId = buildChoiceId(decisionId, "N");
  const newLines = [
    `  ${decisionId}{"New Decision"}`,
    `  ${yesId}["Yes"]`,
    `  ${noId}["No"]`,
    `  ${sourceId} --> ${decisionId}`,
    `  ${decisionId} --> ${yesId}`,
    `  ${decisionId} --> ${noId}`
  ];
  const restoredIds = new Set;
  for (const edge of successors) {
    appendInlineDeclaration(newLines, restoredIds, graph, edge, edge.to);
    newLines.push(`  ${yesId} --> ${edge.to}`);
  }
  for (const edge of graph.edges) {
    const isOnRemovedLine = removedLineIndexes.has(edge.lineIndex);
    const isFromSource = edge.from === sourceId;
    const shouldKeep = isOnRemovedLine && !isFromSource;
    if (!shouldKeep)
      continue;
    appendInlineDeclaration(newLines, restoredIds, graph, edge, edge.from);
    appendInlineDeclaration(newLines, restoredIds, graph, edge, edge.to);
    newLines.push(edge.label ? `  ${edge.from} -- "${edge.label}" --> ${edge.to}` : `  ${edge.from} --> ${edge.to}`);
  }
  await applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines));
  selectEditorNode(decisionId);
  setInspectorTextFocus();
}
async function createDecisionAfter(sourceId, graph) {
  await insertDecisionAfterNode(sourceId, graph);
}
async function appendChoiceToDecision(questionId, graph) {
  const removedLineIndexes = new Set;
  let suffix = "NEW";
  let n = 1;
  while (graph.nodes.has(buildChoiceId(questionId, suffix)))
    suffix = "NEW" + ++n;
  const cid = buildChoiceId(questionId, suffix);
  const newLines = [`  ${cid}["New choice"]`, `  ${questionId} --> ${cid}`];
  await applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines));
  selectEditorNode(questionId);
}
function addChoiceOnDecision() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const questionId = state.selectedEditorNodeId;
  setEditorActionPromise(appendChoiceToDecision(questionId, graph));
}

// editor-insert-before.ts
function insertStaticBefore() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
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
  const staticId = getNextEditorId("B_NEW", graph);
  const newLines = [`  ${staticId}["New static block"]`];
  const restoredIds = new Set;
  const isSelectedOnRemovedLine = removedLineIndexes.has(selectedNode.lineIndex);
  if (isSelectedOnRemovedLine)
    newLines.push(`  ${selected}${getDeclarationSuffix(selectedNode)}`);
  restoredIds.add(selected);
  for (const edge of predecessors)
    appendInlineDeclaration(newLines, restoredIds, graph, edge, edge.from);
  for (const edge of predecessors)
    newLines.push(edge.label ? `  ${edge.from} -- "${edge.label}" --> ${staticId}` : `  ${edge.from} --> ${staticId}`);
  newLines.push(`  ${staticId} --> ${selected}`);
  for (const edge of graph.edges) {
    const isOnRemovedLine = removedLineIndexes.has(edge.lineIndex);
    const isIntoSelected = edge.to === selected;
    const shouldKeep = isOnRemovedLine && !isIntoSelected;
    if (!shouldKeep)
      continue;
    appendInlineDeclaration(newLines, restoredIds, graph, edge, edge.from);
    appendInlineDeclaration(newLines, restoredIds, graph, edge, edge.to);
    newLines.push(edge.label ? `  ${edge.from} -- "${edge.label}" --> ${edge.to}` : `  ${edge.from} --> ${edge.to}`);
  }
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
function insertDecisionBefore() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
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
  const decisionId = getNextEditorId("Q_NEW", graph);
  const newChoiceId = buildChoiceId(decisionId, "NEW");
  const newLines = [
    `  ${decisionId}{"New Decision"}`,
    `  ${newChoiceId}["New choice"]`,
    `  ${decisionId} --> ${newChoiceId}`
  ];
  const isSelectedOnRemovedLine = removedLineIndexes.has(selectedNode.lineIndex);
  if (isSelectedOnRemovedLine)
    newLines.push(`  ${selected}${getDeclarationSuffix(selectedNode)}`);
  for (const edge of predecessors)
    appendInlineDecl(edge, edge.from, graph, newLines);
  for (const edge of predecessors)
    newLines.push(edge.label ? `  ${edge.from} -- "${edge.label}" --> ${decisionId}` : `  ${edge.from} --> ${decisionId}`);
  newLines.push(`  ${newChoiceId} --> ${selected}`);
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}

// editor-remove.ts
function removeChoice() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
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
      appendInlineDecl(edge, otherEndpoint, graph, newLines);
  }
  selectEditorNode(null);
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
function removeBlock() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
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
      appendInlineDecl(edge, edge.to, graph, newLines);
    } else {
      predecessors.push(edge.from);
      appendInlineDecl(edge, edge.from, graph, newLines);
    }
  }
  for (const predecessor of predecessors)
    for (const successor of successors)
      newLines.push(`  ${predecessor} --> ${successor}`);
  selectEditorNode(null);
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}
function removeChoices() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
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
      appendInlineDecl(edge, edge.to, graph, newLines);
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
        appendInlineDecl(inner, otherEndpoint, graph, newLines);
    }
  }
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines)));
}

// editor-remove-question.ts
function removeQuestion() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
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
function moveRemovalPreview() {
  if (!state.pendingRemoval)
    return;
  state.pendingRemoval.index = (state.pendingRemoval.index + 1) % state.pendingRemoval.choices.length;
  renderRemovalPreview();
}
function clearQuestionRemoval() {
  selectEditorNode(null);
}
function applyQuestionRemoval() {
  if (!state.pendingRemoval)
    return;
  const { questionId, choices, index } = state.pendingRemoval;
  const graph = getEditorGraph();
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
    appendInlineDecl(edge, edge.from, graph, newLines);
  }
  let keepSuccessor = choices[index];
  for (const edge of graph.edges) {
    if (edge.from !== questionId)
      continue;
    removedLineIndexes.add(edge.lineIndex);
    const targetNode = graph.nodes.get(edge.to);
    const isImmediateChoice = targetNode?.kind === "choice";
    if (!isImmediateChoice) {
      appendInlineDecl(edge, edge.to, graph, newLines);
      continue;
    }
    removedLineIndexes.add(targetNode.lineIndex);
    for (const inner of graph.edges) {
      if (inner.from !== edge.to)
        continue;
      removedLineIndexes.add(inner.lineIndex);
      if (edge.to === keepSuccessor) {
        appendInlineDecl(inner, inner.to, graph, newLines);
        keepSuccessor = inner.to;
      }
    }
  }
  for (const predecessor of predecessors)
    newLines.push(`  ${predecessor} --> ${keepSuccessor}`);
  const newSource = buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines);
  function applyRemovedQuestionSource() {
    return applyEditorSource(newSource);
  }
  executeEditorAction(applyRemovedQuestionSource);
}

// editor-history.ts
function applyHistoryEntry() {
  return applyEditorSource(state.editorHistory[state.editorHistoryIndex], { recordHistory: false });
}
function applyEditorUndo() {
  if (state.editorHistoryIndex <= 0)
    return;
  state.editorHistoryIndex--;
  selectEditorNode(null);
  executeEditorAction(applyHistoryEntry);
}
function applyEditorRedo() {
  if (state.editorHistoryIndex >= state.editorHistory.length - 1)
    return;
  state.editorHistoryIndex++;
  selectEditorNode(null);
  executeEditorAction(applyHistoryEntry);
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
  applyTypeMetadata(metadata);
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
    graph = getEditorGraph();
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

// path-write.ts
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
  const listResponse = await fetch("/api/diagrams");
  const existingNames = await listResponse.json();
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

// path-export.ts
function getChosenPathIds() {
  const rows = buildHistoryRows(parseEdges(codeBox.value), getEditorGraph());
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
  const graph = getEditorGraph();
  const lines = [...buildDecisionComment(ids, graph), "flowchart TD"];
  const declaredIds = new Set;
  for (const id of ids) {
    const isDeclared = declaredIds.has(id);
    if (isDeclared)
      continue;
    declaredIds.add(id);
    lines.push(`  ${id}${getDeclarationSuffix(graph.nodes.get(id))}`);
  }
  for (let i = 0;i + 1 < ids.length; i++)
    lines.push(`  ${ids[i]} --> ${ids[i + 1]}`);
  lines.push(...buildClassLines(declaredIds));
  return lines.join(`
`) + `
`;
}
async function writeChosenPath() {
  const source = buildChosenPathSource(getChosenPathIds());
  if (state.currentName) {
    await writeToServerDiagrams(state.currentName, source);
    return;
  }
  const openedFileName = state.openedFileHandle?.name ?? state.loadedPath?.split("/").pop();
  if (!openedFileName)
    throw new Error("Save the diagram before writing a chosen path");
  await writeToOpenedFileFolder(openedFileName, source);
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
    const openedFileName = state.openedFileHandle?.name ?? state.loadedPath?.split("/").pop();
    if (!openedFileName)
      throw new Error("Save the diagram before exporting all paths");
    const hasFolder = await selectPathFolder();
    if (!hasFolder) {
      console.log("User canceled Export all paths");
      return;
    }
    setStatus(`Writing 0/${sources.length} paths`);
    for (let writtenCount = 1;writtenCount <= sources.length; writtenCount++) {
      await writeToOpenedFileFolder(openedFileName, sources[writtenCount - 1]);
      setStatus(`Writing ${writtenCount}/${sources.length} paths`);
    }
  }
  setStatus(`Wrote ${sources.length} paths`);
}
document.getElementById("exportAllPathsBtn").addEventListener("click", writeAllPaths);

// editor-commit.ts
function updateNodeText(id = state.selectedEditorNodeId, text = nodeTextInput.value.trim()) {
  if (!id)
    return;
  const advance = state.advanceAfterDecisionText?.decisionId === id ? state.advanceAfterDecisionText : null;
  const focusDestination = state.focusDestinationAfterTextId === id;
  if (advance)
    state.advanceAfterDecisionText = null;
  if (focusDestination)
    state.focusDestinationAfterTextId = null;
  async function applyNodeTextUpdate() {
    const graph = getEditorGraph();
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
      setInspectorDestinationFocus();
    } else if (focusDestination) {
      selectEditorNode(id);
      setInspectorDestinationFocus();
    }
  }
  appendEditorAction(applyNodeTextUpdate);
}
function applyDestination(destination) {
  const id = state.selectedEditorNodeId;
  if (!id)
    return;
  const graph = getEditorGraph();
  const node = graph.nodes.get(id);
  const isMissing = !node;
  const isQuestion = node?.kind === "question";
  const isUnsupported = isMissing || isQuestion;
  if (isUnsupported)
    return;
  const createsStatic = destination === NEW_STATIC_DESTINATION;
  const createsDecision = destination === NEW_DECISION_DESTINATION;
  const createsNothing = !createsStatic && !createsDecision;
  const isSameDestination = findOutgoingDestination(id, graph) === (destination || undefined);
  const isUnchanged = createsNothing && isSameDestination;
  if (isUnchanged)
    return;
  const text = nodeTextInput.value.trim();
  if (text !== node.label)
    updateNodeText(id, text);
  async function applyDestinationChange() {
    const currentGraph = getEditorGraph();
    if (createsStatic)
      await createStaticAfter(id, currentGraph);
    else if (createsDecision)
      await createDecisionAfter(id, currentGraph);
    else {
      const source = destination ? replaceOutgoing(id, destination, currentGraph) : removeOutgoing(id, currentGraph);
      await applyEditorSource(source);
    }
    moveNodeToViewportCenter(outputBox, diagramBox, id);
  }
  appendEditorAction(applyDestinationChange);
}
function applyDestinationSelection() {
  applyDestination(destinationSelect.value);
}

// editor-inspector-events.ts
function openNodeTextEditor(event) {
  const nodeEl = event.target.closest("g.node");
  if (!nodeEl)
    return;
  selectEditorNode(getNodeId(nodeEl));
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
document.getElementById("nextRemovalPathBtn").addEventListener("click", moveRemovalPreview);
document.getElementById("confirmRemoveQuestionBtn").addEventListener("click", applyQuestionRemoval);
document.getElementById("cancelRemoveQuestionBtn").addEventListener("click", clearQuestionRemoval);
document.getElementById("editorUndoBtn").addEventListener("click", applyEditorUndo);
document.getElementById("editorRedoBtn").addEventListener("click", applyEditorRedo);
function clearEditorSelection() {
  selectEditorNode(null);
}
document.getElementById("nodeInspectorDismissBtn").addEventListener("click", clearEditorSelection);
destinationSelect.addEventListener("change", applyDestinationSelection);
function dispatchInspectorAction(event) {
  const button = event.target.closest("button[data-action]");
  const action = button?.dataset.action;
  if (action === "add-static-after")
    applyDestination(NEW_STATIC_DESTINATION);
  else if (action === "insert-static-after") {
    if (!state.selectedEditorNodeId)
      return;
    setEditorActionPromise(insertStaticAfterNode(state.selectedEditorNodeId, getEditorGraph()));
  } else if (action === "insert-decision-after") {
    if (!state.selectedEditorNodeId)
      return;
    setEditorActionPromise(insertDecisionAfterNode(state.selectedEditorNodeId, getEditorGraph()));
  } else if (action === "add-decision-after")
    applyDestination(NEW_DECISION_DESTINATION);
  else if (action === "add-choice")
    addChoiceOnDecision();
  else if (action === "remove") {
    const kind = getEditorGraph().nodes.get(state.selectedEditorNodeId ?? "")?.kind;
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
  updateNodeText();
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
    updateNodeText(id, text);
    return;
  }
  function writeNodeTextLater() {
    updateNodeText(id, text);
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
outputBox.addEventListener("scroll", updateNodeInspectorPosition);
window.addEventListener("resize", updateNodeInspectorPosition);

// class-source.ts
function buildLinesWithoutNodeClass(lines, nodeId) {
  const result = [];
  for (const line of lines) {
    const isLineCommented = isCommented(line);
    const match = line.match(CLASS_LINE_RE);
    const hasNoMatch = !match;
    const isUnrelated = isLineCommented || hasNoMatch;
    if (isUnrelated) {
      result.push(line);
      continue;
    }
    const ids = match[2].split(",");
    const withoutId = [];
    for (const id of ids) {
      const isOtherNode = id !== nodeId;
      if (isOtherNode)
        withoutId.push(id);
    }
    const isUnchanged = withoutId.length === ids.length;
    if (isUnchanged) {
      result.push(line);
      continue;
    }
    const isEmpty = withoutId.length === 0;
    if (isEmpty)
      result.push(`%% ${line.trim()}`);
    else
      result.push(`${match[1]}class ${withoutId.join(",")} ${match[3]}`);
  }
  return result;
}
function buildSourceWithAssignedClass(source, nodeId, className) {
  const lines = buildLinesWithoutNodeClass(source.split(`
`), nodeId);
  if (className === null)
    return lines.join(`
`);
  let assigned = false;
  let lastClassLineIndex = -1;
  for (let i = 0;i < lines.length; i++) {
    const isLineCommented = isCommented(lines[i]);
    if (isLineCommented)
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
function buildSourceWithCreatedClass(source, name, fill, stroke) {
  const lines = source.split(`
`);
  const newLine = `classDef ${name} fill:${fill},stroke:${stroke}`;
  let lastClassDefLineIndex = -1;
  for (let i = 0;i < lines.length; i++) {
    const isLineCommented = isCommented(lines[i]);
    if (isLineCommented)
      continue;
    const isClassDefLine = CLASSDEF_LINE_RE.test(lines[i]);
    if (isClassDefLine)
      lastClassDefLineIndex = i;
  }
  if (lastClassDefLineIndex === -1)
    lines.push(newLine);
  else
    lines.splice(lastClassDefLineIndex + 1, 0, newLine);
  return lines.join(`
`);
}
function buildSourceWithClassColors(source, name, fill, stroke) {
  const result = [];
  for (const line of source.split(`
`)) {
    const isLineCommented = isCommented(line);
    const match = line.match(CLASSDEF_LINE_RE);
    const isOtherClass = match?.[2] !== name;
    const isUnrelated = isLineCommented || isOtherClass;
    if (isUnrelated) {
      result.push(line);
      continue;
    }
    const { order, props } = parseStyleProps(match[3]);
    const hasFill = order.includes("fill");
    if (!hasFill)
      order.push("fill");
    const hasStroke = order.includes("stroke");
    if (!hasStroke)
      order.push("stroke");
    props.fill = fill;
    props.stroke = stroke;
    result.push(`${match[1]}classDef ${name} ${buildStyleText(order, props)}`);
  }
  return result.join(`
`);
}
function buildSourceWithRenamedClass(source, oldName, newName) {
  const result = [];
  for (const line of source.split(`
`)) {
    const isLineCommented = isCommented(line);
    if (isLineCommented) {
      result.push(line);
      continue;
    }
    const classDefMatch = line.match(CLASSDEF_LINE_RE);
    const isRenamedDef = classDefMatch?.[2] === oldName;
    if (isRenamedDef) {
      result.push(`${classDefMatch[1]}classDef ${newName} ${classDefMatch[3]}`);
      continue;
    }
    const classMatch = line.match(CLASS_LINE_RE);
    const isRenamedAssignment = classMatch?.[3] === oldName;
    if (isRenamedAssignment)
      result.push(`${classMatch[1]}class ${classMatch[2]} ${newName}`);
    else
      result.push(line);
  }
  return result.join(`
`);
}
function buildSourceWithDeletedClass(source, name) {
  const result = [];
  for (const line of source.split(`
`)) {
    const isLineCommented = isCommented(line);
    const match = line.match(CLASSDEF_LINE_RE);
    const isOtherClass = match?.[2] !== name;
    const isUnrelated = isLineCommented || isOtherClass;
    if (isUnrelated)
      result.push(line);
    else
      result.push(`%% ${line.trim()}`);
  }
  return result.join(`
`);
}

// class-defs.ts
async function setNodeClass(nodeId, className) {
  await applyEditorSource(buildSourceWithAssignedClass(codeBox.value, nodeId, className));
}
async function createClass(name, fill, stroke) {
  await applyEditorSource(buildSourceWithCreatedClass(codeBox.value, name, fill, stroke));
}
async function setClassColors(name, fill, stroke) {
  await applyEditorSource(buildSourceWithClassColors(codeBox.value, name, fill, stroke));
}
async function renameClass(oldName, newName) {
  await applyEditorSource(buildSourceWithRenamedClass(codeBox.value, oldName, newName));
}
async function removeClass(name) {
  await applyEditorSource(buildSourceWithDeletedClass(codeBox.value, name));
}

// editor-classes-render.ts
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

// editor-class-events.ts
function toggleClassPickerList() {
  classPickerList.hidden = !classPickerList.hidden;
}
function clearClassPickerOnOutsideClick(event) {
  const insidePicker = event.target.closest("#classPicker");
  if (!insidePicker)
    classPickerList.hidden = true;
}
function selectClassPickerRow(event) {
  const button = event.target.closest("button.class-picker-row");
  if (!button)
    return;
  const nodeId = classPickerBtn.dataset.nodeId;
  classPickerList.hidden = true;
  if (button.dataset.className)
    setEditorActionPromise(setNodeClass(nodeId, button.dataset.className));
  else if (button.dataset.classNone !== undefined)
    setEditorActionPromise(setNodeClass(nodeId, null));
  else if (button.dataset.classNew !== undefined)
    openClassEditor(nodeId);
}
classPickerBtn.addEventListener("click", toggleClassPickerList);
document.addEventListener("click", clearClassPickerOnOutsideClick);
classPickerList.addEventListener("click", selectClassPickerRow);
var classEditorAssignNodeId = null;
function openClassEditor(assignToNodeId) {
  classEditorAssignNodeId = assignToNodeId;
  classEditorName.value = "";
  classEditorFill.value = "#ffffff";
  classEditorStroke.value = "#000000";
  classEditorError.textContent = "";
  classEditorDialog.showModal();
}
function closeClassEditor() {
  classEditorDialog.close();
}
function createClassFromEditor() {
  const name = classEditorName.value.trim();
  if (!name) {
    classEditorError.textContent = "Name is required.";
    return;
  }
  const existingClassDef = findClassDef(codeBox.value, name);
  if (existingClassDef) {
    classEditorError.textContent = `Class "${name}" already exists.`;
    return;
  }
  classEditorError.textContent = "";
  const assignToNodeId = classEditorAssignNodeId;
  setEditorActionPromise((async () => {
    await createClass(name, classEditorFill.value, classEditorStroke.value);
    if (assignToNodeId)
      await setNodeClass(assignToNodeId, name);
    if (classesDialog.open)
      renderClassesDialog();
  })());
  classEditorDialog.close();
}
classEditorCancelBtn.addEventListener("click", closeClassEditor);
classEditorCreateBtn.addEventListener("click", createClassFromEditor);

// editor-classes-dialog.ts
function openClassesDialog() {
  document.getElementById("fileMenu").removeAttribute("open");
  renderClassesDialog();
  classesDialog.showModal();
}
function closeClassesDialog() {
  classesDialog.close();
}
function openNewClassEditor() {
  openClassEditor(null);
}
function updateClassFromRow(event) {
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
}
function removeClassFromRow(event) {
  const button = event.target.closest(".classes-delete");
  if (!button)
    return;
  const name = button.closest(".classes-row").dataset.className;
  setEditorActionPromise(removeClass(name).then(renderClassesDialog));
}
classesMenuBtn.addEventListener("click", openClassesDialog);
classesCloseBtn.addEventListener("click", closeClassesDialog);
classesNewBtn.addEventListener("click", openNewClassEditor);
classesList.addEventListener("change", updateClassFromRow);
classesList.addEventListener("click", removeClassFromRow);

// editor-events.ts
function setCodeBoxScrollToLine(lineNum) {
  const style = getComputedStyle(codeBox);
  const mirror = document.createElement("div");
  mirror.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;width:${codeBox.clientWidth}px;padding:${style.padding};font:${style.font};line-height:${style.lineHeight};`;
  const allLines = codeBox.value.split(`
`);
  let textAbove = "";
  for (let i = 0;i < lineNum; i++)
    textAbove += allLines[i] + `
`;
  mirror.textContent = textAbove;
  const lineMarker = document.createElement("span");
  lineMarker.textContent = "x";
  mirror.append(lineMarker);
  document.body.append(mirror);
  codeBox.scrollTop = lineMarker.offsetTop - parseFloat(style.paddingTop);
  mirror.remove();
}
function selectNodeSourceLine(id) {
  const lines = codeBox.value.split(`
`);
  let start = 0;
  for (let i = 0;i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const startsWithId = trimmed.startsWith(id);
    const isNodeDefinition = startsWithId && ["[", "{", "("].includes(trimmed.charAt(id.length));
    if (isNodeDefinition) {
      const isDrawerOpen = !drawer.classList.contains("closed");
      if (isDrawerOpen)
        setCodeBoxScrollToLine(i);
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
  const id = nodeEl ? getNodeId(nodeEl) : null;
  if (id)
    selectNodeSourceLine(id);
  selectEditorNode(id);
  if (id) {
    const graph = getEditorGraph();
    const node = graph.nodes.get(id);
    if (node?.kind === "question") {
      state.phoneFocusNodeId = id;
      state.phoneFocusUsesDecisionContext = true;
      state.phonePreviewChoiceId = null;
      render();
    } else {
      const feedingChoice = findNearestFeedingChoice(id, graph);
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
      const answers = findAnswersLeadingTo(parentOf(choiceId, edges), edges, getEditorGraph());
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
  applyTypeMetadata(splitEditorMetadata(codeBox.value).metadata);
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
function compareNodesByLine2(a, b) {
  return a.lineIndex - b.lineIndex;
}
function findMatchingNodes(graph, query) {
  const matches = [];
  if (query === "")
    return matches;
  const needle = query.toLowerCase();
  for (const node of graph.nodes.values()) {
    const idMatches = node.id.toLowerCase().includes(needle);
    const labelMatches = node.label.toLowerCase().includes(needle);
    const isMatch = idMatches || labelMatches;
    if (isMatch)
      matches.push(node);
  }
  matches.sort(compareNodesByLine2);
  return matches;
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
async function moveToSearchMatch() {
  const runId = ++searchRunId;
  const id = searchMatches[searchIndex].id;
  selectEditorNode(id);
  await render();
  if (runId !== searchRunId)
    return;
  selectEditorNode(id);
  moveNodeToViewportCenter(outputBox, diagramBox, id);
}
async function executeSearch() {
  let graph;
  try {
    graph = getEditorGraph();
  } catch (error) {
    reportEditorValidationError(error);
    return;
  }
  searchMatches = findMatchingNodes(graph, searchInput.value);
  searchIndex = 0;
  updateSearchControls();
  if (searchMatches.length === 0)
    return;
  await moveToSearchMatch();
}
async function moveSearchSelection(step) {
  searchIndex = (searchIndex + step + searchMatches.length) % searchMatches.length;
  updateSearchControls();
  await moveToSearchMatch();
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
  applyTypeMetadata(null);
  codeBox.value = `flowchart TD
  B_NEW[New idea]`;
  resetEditorHistory(codeBox.value);
  render();
  loadList();
  setDrawerOpen(true);
}
function selectPreviousDecision() {
  moveToDecision(-1);
}
function selectNextDecision() {
  moveToDecision(1);
}
function selectPreviousSearchMatch() {
  moveSearchSelection(-1);
}
function selectNextSearchMatch() {
  moveSearchSelection(1);
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
  applyPathHighlight();
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
searchInput.addEventListener("input", executeSearch);
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
Object.assign(window, { loadDiagram, codeBox, getNodeId, selectEditorNode, addQuestionAfter, addBlockAfter, removeQuestion, removeBlock, addChoice, removeChoice, removeChoices, applyEditorUndo, applyEditorRedo, insertStaticBefore, insertDecisionBefore, listAllPathIds });
