// editor-types.ts
var INSPECTOR_TITLES = { question: "Decision block", block: "static block", choice: "choice block" };
var NOTE_PREFIX = "%% ==note==:";
var SIZE_PREFIX = "%% ==size==:";
var ALIGN_PREFIX = "%% ==align==:";

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

// node-align.ts
var ALIGN_LINE_PATTERN = /^%% ==align==: ([A-Za-z0-9_]+) (left|center|right) (top|center|bottom)$/;
function parseAlignLine(line) {
  const match = line.trim().match(ALIGN_LINE_PATTERN);
  if (!match)
    return null;
  return { id: match[1], justification: match[2], alignment: match[3] };
}
function getNodeAlign(lines, id) {
  for (const line of lines) {
    const align = parseAlignLine(line);
    if (align?.id === id)
      return align;
  }
  return { id, justification: "center", alignment: "center" };
}
function buildAlignLine(id, justification, alignment) {
  return `${ALIGN_PREFIX} ${id} ${justification} ${alignment}`;
}
function buildSourceWithoutNodeAlign(source, id) {
  const keptLines = [];
  for (const line of source.split(`
`)) {
    const align = parseAlignLine(line);
    const isOldLineOfNode = align?.id === id;
    if (!isOldLineOfNode)
      keptLines.push(line);
  }
  return keptLines.join(`
`);
}
function buildSourceWithNodeAlign(source, id, justification, alignment) {
  const sourceWithoutOldLine = buildSourceWithoutNodeAlign(source, id);
  const isDefault = justification === "center" && alignment === "center";
  if (isDefault)
    return sourceWithoutOldLine;
  const body = sourceWithoutOldLine.replace(/\s+$/, "");
  return `${body}
${buildAlignLine(id, justification, alignment)}`;
}

// node-size.ts
var TEXT_PADDING = 4;
var MERMAID_PADDING_X = 16;
var MERMAID_RECT_PADDING_Y = 12;
var MERMAID_HEXAGON_PADDING_Y = 35;
var HEXAGON_LABEL_MARGIN_Y = 11;
var LABEL_MARGIN_X = MERMAID_PADDING_X - TEXT_PADDING;
var RECT_LABEL_MARGIN = `-${MERMAID_RECT_PADDING_Y - TEXT_PADDING}px -${LABEL_MARGIN_X}px`;
var HEXAGON_LABEL_MARGIN = `-${HEXAGON_LABEL_MARGIN_Y}px -${LABEL_MARGIN_X}px`;
var NODE_PADDING_WIDTH = 2 * TEXT_PADDING;
var NODE_PADDING_HEIGHT = 2 * TEXT_PADDING;
var HEXAGON_PADDING_HEIGHT = 2 * (MERMAID_HEXAGON_PADDING_Y - HEXAGON_LABEL_MARGIN_Y);
var HEXAGON_POINTS_WIDTH_RATIO = 4 / 7;
var FLEX_JUSTIFY_CONTENT = { left: "flex-start", center: "center", right: "flex-end" };
var FLEX_ALIGN_ITEMS = { top: "flex-start", center: "center", bottom: "flex-end" };
var SIZE_LINE_PATTERN = /^%% ==size==: ([A-Za-z0-9_]+) (\d+) (\d+)$/;
var DECLARATION_PATTERN = /^(\s*)([A-Za-z0-9_]+)(\[|\{\{)"(.*)"(\]|\}\})\s*$/;
function parseSizeLine(line) {
  const match = line.trim().match(SIZE_LINE_PATTERN);
  if (!match)
    return null;
  return { id: match[1], width: Number(match[2]), height: Number(match[3]) };
}
function buildSizeLine(id, width, height) {
  return `${SIZE_PREFIX} ${id} ${width} ${height}`;
}
function buildSourceWithoutNodeSize(source, id) {
  const keptLines = [];
  for (const line of source.split(`
`)) {
    const size = parseSizeLine(line);
    const isOldLineOfNode = size?.id === id;
    if (!isOldLineOfNode)
      keptLines.push(line);
  }
  return keptLines.join(`
`);
}
function buildSourceWithNodeSize(source, id, width, height) {
  const body = buildSourceWithoutNodeSize(source, id).replace(/\s+$/, "");
  return `${body}
${buildSizeLine(id, width, height)}`;
}
function buildSourceWithSizeWrappers(source) {
  const lines = source.split(`
`);
  const sizes = new Map;
  for (const line of lines) {
    const size = parseSizeLine(line);
    if (size)
      sizes.set(size.id, size);
  }
  const aligns = new Map;
  for (const line of lines) {
    const align = parseAlignLine(line);
    if (align)
      aligns.set(align.id, align);
  }
  const wrappedLines = [];
  for (const line of lines) {
    const declaration = line.match(DECLARATION_PATTERN);
    if (!declaration) {
      wrappedLines.push(line);
      continue;
    }
    const size = sizes.get(declaration[2]);
    const align = aligns.get(declaration[2]);
    const [, indent, id, open, label, close] = declaration;
    const isHexagon = open === "{{";
    const labelMargin = isHexagon ? HEXAGON_LABEL_MARGIN : RECT_LABEL_MARGIN;
    if (!size) {
      let style = `margin:${labelMargin}`;
      if (align) {
        if (align.justification !== "center")
          style += `;text-align:${align.justification}`;
      }
      wrappedLines.push(`${indent}${id}${open}"<div style='${style}'>${label}</div>"${close}`);
      continue;
    }
    let wrapperWidth = size.width - NODE_PADDING_WIDTH;
    let wrapperHeight = size.height - NODE_PADDING_HEIGHT;
    if (isHexagon) {
      wrapperWidth = Number((size.width - NODE_PADDING_WIDTH - HEXAGON_POINTS_WIDTH_RATIO * size.height).toFixed(2));
      wrapperHeight = size.height - HEXAGON_PADDING_HEIGHT;
    }
    const justification = align?.justification ?? "center";
    const alignment = align?.alignment ?? "center";
    const style = `display:flex;align-items:${FLEX_ALIGN_ITEMS[alignment]};justify-content:${FLEX_JUSTIFY_CONTENT[justification]};width:max(${wrapperWidth}px,25ch);min-height:max(${wrapperHeight}px,2lh);white-space:normal;margin:${labelMargin}`;
    const labelOpen = justification === "center" ? "<div>" : `<div style='text-align:${justification}'>`;
    wrappedLines.push(`${indent}${id}${open}"<div style='${style}'>${labelOpen}${label}</div></div>"${close}`);
  }
  return wrappedLines.join(`
`);
}

// dom.ts
var darkModeToggle = document.getElementById("darkModeToggle");
var getLabelWrapWidthInPixels = () => {
  const probe = document.createElement("div");
  probe.style.cssText = 'position:absolute;visibility:hidden;font:16px "trebuchet ms", verdana, arial, sans-serif;width:80ch';
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width - 2 * LABEL_MARGIN_X;
};
var getMermaidOptions = () => ({ startOnLoad: false, suppressErrorRendering: true, maxTextSize: 1e6, flowchart: { wrappingWidth: getLabelWrapWidthInPixels(), minNodeWidth: 0 }, theme: darkModeToggle.checked ? "dark" : "default", themeVariables: darkModeToggle.checked ? { primaryColor: "#ececff", nodeBkg: "#ececff", mainBkg: "#ececff", primaryTextColor: "#000", nodeTextColor: "#000", primaryBorderColor: "#9370db", nodeBorder: "#9370db" } : {} });
mermaid.initialize(getMermaidOptions());
var codeBox = document.getElementById("code");
var sourceGutter = document.getElementById("sourceGutter");
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
var multiSelectBadge = document.getElementById("multiSelectBadge");
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
var nodeKindStaticBox = document.getElementById("nodeKindStatic");
var nodeKindQuestionBox = document.getElementById("nodeKindQuestion");
var nodeKindChoiceBox = document.getElementById("nodeKindChoice");
var decisionShapeRow = document.getElementById("decisionShapeRow");
var decisionShapeSwitch = document.getElementById("decisionShapeSwitch");
var nodeParentLabel = document.getElementById("nodeParentLabel");
var nodeNameInput = document.getElementById("nodeNameInput");
var nodeNameCheck = document.getElementById("nodeNameCheck");
var inspectorNotice = document.getElementById("inspectorNotice");
var nodeNotesRow = document.getElementById("nodeNotesRow");
var nodeNotesInput = document.getElementById("nodeNotesInput");
var nodeClassRow = document.getElementById("nodeClassRow");
var nodeAlignRow = document.getElementById("nodeAlignRow");
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
var walkBackBtn = document.getElementById("walkBackBtn");
var walkBackDialog = document.getElementById("walkBackDialog");
var walkBackChoices = document.getElementById("walkBackChoices");
var walkBackCancelBtn = document.getElementById("walkBackCancelBtn");
var nodeInspectorDismissBtn = document.getElementById("nodeInspectorDismissBtn");
var destinationRow = document.getElementById("destinationRow");
var destinationSelect = document.getElementById("destinationSelect");
var destinationInput = document.getElementById("destinationInput");
var destinationList = document.getElementById("destinationList");
var nodeInspectorActions = document.getElementById("nodeInspectorActions");
var nodeInspectorControls = document.getElementById("nodeInspectorControls");
var nodeInspectorRemovalPreview = document.getElementById("nodeInspectorRemovalPreview");
var searchInput = document.getElementById("searchInput");
var searchClearBtn = document.getElementById("searchClearBtn");
var searchPreviousBtn = document.getElementById("searchPreviousBtn");
var searchNextBtn = document.getElementById("searchNextBtn");
var searchCounter = document.getElementById("searchCounter");
var viewportMenu = document.getElementById("viewportMenu");
var addDecisionBlockMenuBtn = document.getElementById("addDecisionBlockMenuBtn");
var addStaticBlockMenuBtn = document.getElementById("addStaticBlockMenuBtn");

// node-inspector-focus.ts
function updateNodeInspectorPosition() {}
function setInspectorTextFocus() {
  nodeTextInput.focus();
  nodeTextInput.select();
}
function setInspectorDestinationFocus() {
  destinationInput.focus();
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
  phoneStartNodeId: null,
  phoneClickedNodeId: null,
  phoneClickedAtMs: 0,
  diagramScale: null,
  mainZoomPercent: 100,
  functionsOnly: false,
  selectedEditorNodeId: null,
  multiSelectedNodeIds: [],
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
function encodeLabelQuotes(text) {
  return text.replace(/"/g, "#quot;").replace(/`/g, "#96;");
}
function decodeLabelQuotes(label) {
  return label.replace(/#quot;/g, '"').replace(/#96;/g, "`");
}
function encodeLabelLineBreaks(text, previousLabel = "") {
  const usesBackslashN = previousLabel.includes("\\n") && !/<br\s*\/?>/i.test(previousLabel);
  return text.replace(/\n/g, usesBackslashN ? "\\n" : "<br/>");
}
function decodeLabelLineBreaks(label) {
  return label.replace(/<br\s*\/?>/gi, `
`).replace(/\\n/g, `
`);
}
function getOneLineLabel(label) {
  return decodeLabelQuotes(label).replace(/<br\s*\/?>/gi, " ").replace(/\\n/g, " ");
}
function parseEditorToken(token) {
  const match = token.match(/^([A-Za-z0-9_]+)([\s\S]*)$/);
  if (!match)
    return { id: token, shape: null, label: "" };
  const id = match[1];
  const rest = match[2].trim();
  const startsHexagon = rest.startsWith("{{");
  const endsHexagon = rest.endsWith("}}");
  const isHexagon = startsHexagon && endsHexagon;
  if (isHexagon)
    return { id, shape: "hexagon", label: trimEditorQuotes(rest.slice(2, -2)) };
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
    return 'start with "Q_" and use diamond shape {} or hexagon shape {{}}';
  const isBlock = id.startsWith("B_");
  if (isBlock)
    return 'start with "B_" and use bracket shape []';
  return 'use "Q_" with diamond shape {} or hexagon shape {{}} for a decision, "Q_CHOICE" with bracket shape [] for a choice, or "B_" with bracket shape [] for a static block';
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
    const isDecisionShape = shape === "brace" || shape === "hexagon";
    if (!isDecisionShape)
      problems.push(`${subject} is a decision and must use diamond shape {} or hexagon shape {{}} (for example, ${id}{{"Decision"}}).`);
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
    return node.isHexagon ? `{{"${node.label}"}}` : `{"${node.label}"}`;
  if (node.kind === "choice")
    return `["${node.label}"]`;
  return `["${node.label}"]`;
}

// editor-graph-parse.ts
function storeDeclaration(declLines, token, lineIndex) {
  const isDeclaration = !!token.shape;
  const isNew = !declLines.has(token.id);
  const shouldStore = isDeclaration && isNew;
  if (shouldStore)
    declLines.set(token.id, { shape: token.shape, label: token.label, lineIndex });
}
function parseEditorGraph(source) {
  const lines = source.split(`
`);
  const declLines = new Map;
  const edges = [];
  const references = new Map;
  const multiLineIds = new Set;
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
      } else {
        const opensQuotedLabel = line.match(/^([A-Za-z0-9_]+)(?:\[|\{\{?|\(\[)"/);
        if (opensQuotedLabel) {
          multiLineIds.add(opensQuotedLabel[1]);
          problems.push(`Line ${lineIndex + 1}: the definition of "${opensQuotedLabel[1]}" must start and end on one line. Its text has a line break.`);
        }
      }
    }
  }
  for (const [id, lineIndex] of references) {
    const isUndeclared = !declLines.has(id);
    if (isUndeclared && multiLineIds.has(id))
      continue;
    if (isUndeclared)
      problems.push(`Line ${lineIndex + 1}: id "${id}" must be declared on its own standalone line and ${getDeclarationRequirement(id)}.`);
  }
  const blockExits = new Map;
  for (const edge of edges) {
    const isBlock = !edge.from.startsWith("Q_");
    if (!isBlock)
      continue;
    const exit = blockExits.get(edge.from) ?? { firstEdgeLineIndex: edge.lineIndex, nextIds: new Set };
    exit.nextIds.add(edge.to);
    blockExits.set(edge.from, exit);
  }
  for (const [id, exit] of blockExits) {
    const leadsToManyNodes = exit.nextIds.size >= 2;
    if (leadsToManyNodes)
      problems.push(`Line ${exit.firstEdgeLineIndex + 1}: block "${id}" leads to ${exit.nextIds.size} nodes (${[...exit.nextIds].join(", ")}); a block must lead to one node, so the phone view can follow one question at a time.`);
  }
  const sizes = new Map;
  for (let lineIndex = 0;lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    if (!line.startsWith(SIZE_PREFIX))
      continue;
    const size = parseSizeLine(line);
    if (!size) {
      problems.push(`Line ${lineIndex + 1}: the size line must look like "${buildSizeLine("B_NAME", 352, 154)}": the node id, then the width and the height in whole px.`);
      continue;
    }
    if (!declLines.has(size.id)) {
      problems.push(`Line ${lineIndex + 1}: the size line names "${size.id}", which is not declared.`);
      continue;
    }
    if (sizes.has(size.id)) {
      problems.push(`Line ${lineIndex + 1}: "${size.id}" has two size lines; keep one.`);
      continue;
    }
    sizes.set(size.id, { width: size.width, height: size.height });
  }
  const uniqueProblems = [...new Set(problems)];
  const nodes = new Map;
  for (const [id, decl] of declLines) {
    const kind = id.startsWith("Q_CHOICE") ? "choice" : id.startsWith("Q_") ? "question" : "block";
    const noteLines = [];
    for (let i = decl.lineIndex - 1;i >= 0 && lines[i].trim().startsWith(NOTE_PREFIX); i--)
      noteLines.unshift(lines[i].trim().slice(NOTE_PREFIX.length).trim());
    nodes.set(id, { id, kind, label: decl.label, note: noteLines.join(`
`), lineIndex: decl.lineIndex, isHexagon: decl.shape === "hexagon", size: sizes.get(id) });
  }
  return { graph: { lines, nodes, edges }, problems: uniqueProblems };
}

// editor-graph.ts
function getEditorGraph() {
  const { graph, problems } = parseEditorGraph(codeBox.value);
  if (problems.length) {
    const error = new EditorValidationError(problems);
    reportEditorValidationError(error);
    throw error;
  }
  return graph;
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
  return { id, kind, label, note: "", lineIndex };
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

// class-lines.ts
var CLASSDEF_LINE_RE = /^(\s*)classDef\s+(\S+)\s+(.+?)\s*$/;
var CLASS_LINE_RE = /^(\s*)class\s+(\S+)\s+(\S+)\s*$/;
function moveClassLinesToEnd(source) {
  const otherLines = [];
  const classLines = [];
  for (const line of source.split(`
`)) {
    if (CLASS_LINE_RE.test(line))
      classLines.push(line);
    else
      otherLines.push(line);
  }
  return [...otherLines, ...classLines].join(`
`);
}
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
function applyNoteDots(graph) {
  for (const nodeEl of diagramBox.querySelectorAll("g.node")) {
    if (!graph.nodes.get(getNodeId(nodeEl))?.note)
      continue;
    const box = nodeEl.getBBox();
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("class", "note-dot");
    dot.setAttribute("cx", String(box.x + 6));
    dot.setAttribute("cy", String(box.y + 6));
    dot.setAttribute("r", "4");
    const fill = getComputedStyle(nodeEl.querySelector("rect, path, polygon")).fill;
    const rgb = fill.match(/rgb\((\d+), (\d+), (\d+)/);
    if (!rgb)
      dot.style.fill = "rgb(11, 75, 75)";
    else {
      const [r, g, b] = rgb.slice(1).map(Number);
      const isMidGray = [r, g, b].every((channel) => channel >= 96 && channel <= 159);
      const midGrayFill = (r + g + b) / 3 >= 128 ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)";
      dot.style.fill = isMidGray ? midGrayFill : `rgb(${255 - r}, ${255 - g}, ${255 - b})`;
    }
    nodeEl.appendChild(dot);
  }
}

// offscreen-arrow-heads.ts
var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
var EDGE_INSET_PX = 2;
var SAMPLE_COUNT = 100;
var REFINE_STEPS = 20;
var DIRECTION_LENGTH = 2;
function getVisibleArea(insetPx) {
  const outputRect = outputBox.getBoundingClientRect();
  const left = outputRect.left + outputBox.clientLeft + insetPx;
  const top = outputRect.top + outputBox.clientTop + insetPx;
  return { left, top, right: left + outputBox.clientWidth - 2 * insetPx, bottom: top + outputBox.clientHeight - 2 * insetPx };
}
function isPointInArea(point, area) {
  if (point.x < area.left)
    return false;
  if (point.x > area.right)
    return false;
  if (point.y < area.top)
    return false;
  if (point.y > area.bottom)
    return false;
  return true;
}
function doesRectOverlapArea(rect, area) {
  if (rect.right < area.left)
    return false;
  if (rect.left > area.right)
    return false;
  if (rect.bottom < area.top)
    return false;
  if (rect.top > area.bottom)
    return false;
  return true;
}
function getScreenPointAtLength(path, length, matrix) {
  return path.getPointAtLength(length).matrixTransform(matrix);
}
function findLastVisibleLength(path, totalLength, matrix, area) {
  let lastInsideLength = -1;
  for (let step = 0;step <= SAMPLE_COUNT; step++) {
    const length = totalLength * step / SAMPLE_COUNT;
    const isInside = isPointInArea(getScreenPointAtLength(path, length, matrix), area);
    if (isInside)
      lastInsideLength = length;
  }
  if (lastInsideLength < 0)
    return null;
  let insideLength = lastInsideLength;
  let outsideLength = Math.min(totalLength, lastInsideLength + totalLength / SAMPLE_COUNT);
  for (let step = 0;step < REFINE_STEPS; step++) {
    const middleLength = (insideLength + outsideLength) / 2;
    const isInside = isPointInArea(getScreenPointAtLength(path, middleLength, matrix), area);
    if (isInside)
      insideLength = middleLength;
    else
      outsideLength = middleLength;
  }
  return insideLength;
}
function buildArrowHead(path, length, marker) {
  const point = path.getPointAtLength(length);
  const pointAhead = path.getPointAtLength(Math.min(length + DIRECTION_LENGTH, path.getTotalLength()));
  const angleDegrees = Math.atan2(pointAhead.y - point.y, pointAhead.x - point.x) * 180 / Math.PI;
  const markerPath = marker.querySelector("path");
  const viewBox = marker.viewBox.baseVal;
  const scale = Math.min(marker.markerWidth.baseVal.value / viewBox.width, marker.markerHeight.baseVal.value / viewBox.height);
  const head = document.createElementNS(SVG_NAMESPACE, "path");
  head.setAttribute("d", markerPath.getAttribute("d"));
  head.setAttribute("class", "arrowMarkerPath offscreen-arrow-head");
  head.setAttribute("style", markerPath.getAttribute("style") ?? "");
  const markerPathStyle = getComputedStyle(markerPath);
  head.style.fill = markerPathStyle.fill;
  head.style.stroke = markerPathStyle.stroke;
  head.setAttribute("transform", `translate(${point.x} ${point.y}) rotate(${angleDegrees}) scale(${scale}) translate(${-marker.refX.baseVal.value} ${-marker.refY.baseVal.value})`);
  head.setAttribute("data-edge-id", path.getAttribute("data-id"));
  return head;
}
function updateOffscreenArrowHeads() {
  for (const oldHead of diagramBox.querySelectorAll(".offscreen-arrow-head"))
    oldHead.remove();
  const visibleArea = getVisibleArea(0);
  const insetArea = getVisibleArea(EDGE_INSET_PX);
  for (const path of diagramBox.querySelectorAll("path.flowchart-link")) {
    const markerEnd = path.getAttribute("marker-end");
    if (markerEnd === null)
      continue;
    if (!doesRectOverlapArea(path.getBoundingClientRect(), visibleArea))
      continue;
    const matrix = path.getScreenCTM();
    const totalLength = path.getTotalLength();
    const endPoint = getScreenPointAtLength(path, totalLength, matrix);
    if (isPointInArea(endPoint, visibleArea))
      continue;
    const lastVisibleLength = findLastVisibleLength(path, totalLength, matrix, insetArea);
    if (lastVisibleLength === null)
      continue;
    const markerId = markerEnd.match(/#([^)"']+)/)[1];
    const marker = diagramBox.querySelector(`#${CSS.escape(markerId)}`);
    path.after(buildArrowHead(path, lastVisibleLength, marker));
  }
}
function scrollToEndBlockOfClickedArrowHead(event) {
  const head = event.target.closest(".offscreen-arrow-head");
  if (!head)
    return;
  event.stopPropagation();
  const path = diagramBox.querySelector(`path.flowchart-link[data-id="${head.getAttribute("data-edge-id")}"]`);
  const [, endBlockId] = getEdgeEnds(path, parseEdges(codeBox.value));
  diagramBox.querySelector(`[id*="flowchart-${endBlockId}-"]`).scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
}
outputBox.addEventListener("click", scrollToEndBlockOfClickedArrowHead, true);
outputBox.addEventListener("scroll", updateOffscreenArrowHeads);
window.addEventListener("resize", updateOffscreenArrowHeads);

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
  const svgOffsetX = outputBox.scrollLeft + svg.getBoundingClientRect().left - outputBox.getBoundingClientRect().left;
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
        outputBox.scrollLeft = svgOffsetX + (centerX - svgOffsetX) * newWidth / oldWidth - outputBox.clientWidth / 2;
        outputBox.scrollTop = centerY * newHeight / oldHeight - outputBox.clientHeight / 2;
      }
    }
  }
  updateOffscreenArrowHeads();
}
function setMainZoomPercent(percent) {
  state.mainZoomPercent = Math.max(MIN_MAIN_ZOOM, Math.min(MAX_MAIN_ZOOM, Math.round(percent)));
  applyMainZoom();
}

// phone-render.ts
function findRoots(edges) {
  const roots = [];
  for (const [candidate] of edges) {
    let hasIncoming = false;
    for (const [, to] of edges) {
      const targetsCandidate = to === candidate;
      if (targetsCandidate) {
        hasIncoming = true;
        break;
      }
    }
    const isNewRoot = !hasIncoming && !roots.includes(candidate);
    if (isNewRoot)
      roots.push(candidate);
  }
  return roots;
}
function isPhoneAwaitingStartNode(edges) {
  const roots = findRoots(edges);
  const hasSeveralStartNodes = roots.length > 1;
  if (!hasSeveralStartNodes)
    return false;
  const hasNoAnswers = phonePath.length === 0;
  if (!hasNoAnswers)
    return false;
  return !roots.includes(state.phoneStartNodeId);
}
function selectPhonePathToNode(nodeId, edges, graph) {
  const isChoice = graph.nodes.get(nodeId)?.kind === "choice";
  const targetId = isChoice ? parentOf(nodeId, edges) : nodeId;
  let startNodeId;
  let answers;
  for (const root of findRoots(edges)) {
    answers = findAnswersFromRoot(root, targetId, edges, graph);
    if (answers) {
      startNodeId = root;
      break;
    }
  }
  if (!answers)
    throw new Error(`No phone path leads from a start node to ${nodeId}`);
  phonePath.length = 0;
  phonePath.push(...answers);
  if (isChoice)
    phonePath.push(nodeId);
  state.phoneStartNodeId = startNodeId;
  state.phoneClickedNodeId = nodeId;
  state.phoneClickedAtMs = Date.now();
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
}
function findHistoryRoot(edges, graph) {
  const roots = findRoots(edges);
  const isClickedStartNodeKnown = roots.includes(state.phoneStartNodeId);
  if (isClickedStartNodeKnown)
    return state.phoneStartNodeId;
  const hasNoAnswers = phonePath.length === 0;
  if (hasNoAnswers)
    return roots[0];
  const firstAnsweredQuestion = parentOf(phonePath[0], edges);
  for (const root of roots) {
    const answers = findAnswersFromRoot(root, firstAnsweredQuestion, edges, graph);
    if (answers)
      return root;
  }
  return roots[0];
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
  let cur = findHistoryRoot(edges, graph);
  let pathIndex = 0;
  const maxSteps = graph.nodes.size + phonePath.length + 1;
  for (let step = 0;step < maxSteps; step++) {
    if (cur === undefined)
      break;
    const kind = graph.nodes.get(cur)?.kind ?? "block";
    if (kind === "question") {
      const choices = choicesOf(cur, edges);
      const hasAnswer = pathIndex < phonePath.length && choices.includes(phonePath[pathIndex]);
      const isSingleChoice = choices.length === 1;
      if (!hasAnswer && !isSingleChoice) {
        rows.push({ status: "active", id: cur });
        break;
      }
      const answered = hasAnswer ? phonePath[pathIndex] : choices[0];
      const declinedChoiceIds = [];
      for (const choiceId of choices) {
        const isChosen = choiceId === answered;
        if (!isChosen)
          declinedChoiceIds.push(choiceId);
      }
      rows.push({ status: "past", id: cur, chosenChoiceId: answered, declinedChoiceIds, revertIndex: pathIndex });
      if (hasAnswer)
        pathIndex++;
      const isAnswerAChoice = graph.nodes.get(answered)?.kind === "choice";
      cur = isAnswerAChoice ? choicesOf(answered, edges)[0] : answered;
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
  for (const root of findRoots(edges)) {
    const answers = findAnswersFromRoot(root, questionId, edges, graph);
    if (answers) {
      state.phoneStartNodeId = root;
      return answers;
    }
  }
  throw new Error(`No phone path leads from the start to ${questionId}`);
}
function findAnswersFromRoot(root, questionId, edges, graph) {
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
  return;
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

// label-code.ts
var LABEL_LINE_BREAK = String.raw`(?:<br\s*\/?>|\\n)`;
var FENCED_CODE_BLOCK_PATTERN = new RegExp("(?:^|" + LABEL_LINE_BREAK + ")```" + LABEL_LINE_BREAK + "([\\s\\S]*?)" + LABEL_LINE_BREAK + "```(?:" + LABEL_LINE_BREAK + "|$)", "gi");
var CODE_LINE_BREAK_PATTERN = new RegExp(LABEL_LINE_BREAK, "i");
var CODE_BLOCK_STYLE = "display:block;text-align:left;white-space:pre";
function buildSourceWithCodeTags(source) {
  return source.replace(/"[^"\n]*"/g, (quoted) => {
    const withBackticks = quoted.slice(1, -1).replace(/#96;/g, "`");
    const withCodeBlocks = withBackticks.replace(FENCED_CODE_BLOCK_PATTERN, (_block, codeText) => {
      const codeLines = codeText.split(CODE_LINE_BREAK_PATTERN).map((codeLine) => codeLine.replace(/&/g, "#amp;").replace(/</g, "#lt;").replace(/>/g, "#gt;").replace(/`/g, "#96;"));
      return `<code style='${CODE_BLOCK_STYLE}'>${codeLines.join("<br/>")}</code>`;
    });
    const withCodeTags = withCodeBlocks.replace(/`([^`]+)`/g, (_span, codeText) => "<code>" + codeText.replace(/&/g, "#amp;").replace(/</g, "#lt;").replace(/>/g, "#gt;") + "</code>");
    return '"' + withCodeTags.replace(/`/g, "#96;") + '"';
  });
}

// phone-html.ts
var PHONE_CLICKED_BORDER_MS = 3000;
var UNCLASSED_PHONE_STYLE = "background:repeating-linear-gradient(45deg, #f4b4b4 0 8px, #fde8e8 8px 16px)";
var classIndex = { assignments: new Map, defsByName: new Map };
function getPhoneNodeAppearance(node, graph) {
  const classStyle = findNodeStyle(classIndex, node.id);
  const textAlignStyle = `;text-align:${getNodeAlign(graph.lines, node.id).justification}`;
  if (!classStyle)
    return { boxStyle: UNCLASSED_PHONE_STYLE + textAlignStyle, labelStyle: "" };
  return { boxStyle: `background:${classStyle.fill};border:2px solid ${classStyle.stroke}${textAlignStyle}`, labelStyle: "" };
}
function encodeHtml(text) {
  const withAmp = text.replace(/&/g, "&amp;");
  const withLt = withAmp.replace(/</g, "&lt;");
  const withGt = withLt.replace(/>/g, "&gt;");
  const withQuote = withGt.replace(/"/g, "&quot;");
  return withQuote.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
}
function getLabelOf(id, graph) {
  return decodeLabelQuotes(graph.nodes.get(id)?.label ?? id);
}
function getLabelHtml(id, graph) {
  const pieces = getLabelOf(id, graph).split(FENCED_CODE_BLOCK_PATTERN);
  const htmlPieces = [];
  for (const [index, piece] of pieces.entries()) {
    const isCodeBlock = index % 2 === 1;
    if (isCodeBlock) {
      const codeLines = piece.split(CODE_LINE_BREAK_PATTERN).map(encodeHtml);
      htmlPieces.push(`<code class="phone-code-block" style="${CODE_BLOCK_STYLE}">${codeLines.join("<br>")}</code>`);
      continue;
    }
    htmlPieces.push(encodeHtml(piece).replace(/\\n/g, "<br>").replace(/`([^`]+)`/g, "<code>$1</code>"));
  }
  return htmlPieces.join("");
}
function buildChoiceButtonsHtml(choices, row, graph) {
  const isPast = row.status === "past";
  const declinedCount = choices.length - 1;
  const declinedPct = 30 / declinedCount;
  const buttons = [];
  for (const choiceId of choices) {
    const label = getLabelHtml(choiceId, graph);
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
    const { boxStyle, labelStyle } = getPhoneNodeAppearance(node, graph);
    return `<div class="${blockClass}" data-node-id="${row.id}" style="${boxStyle}"><span style="${labelStyle}">${getLabelHtml(row.id, graph)}</span></div>`;
  }
  const choices = choicesOf(row.id, edges);
  const activeAttr = row.status === "active" ? " data-active-question" : "";
  const { boxStyle: questionBoxStyle, labelStyle: questionLabelStyle } = getPhoneNodeAppearance(node, graph);
  const question = `<div class="phone-question" data-node-id="${row.id}"${activeAttr} style="${questionBoxStyle}"><span style="${questionLabelStyle}">${getLabelHtml(row.id, graph)}</span></div>`;
  const wrapClass = isMasked ? "phone-decision phone-decision-past" : "phone-decision";
  const isAutoPicked = row.status === "past" && choices.length === 1;
  const buttonsHtml = isAutoPicked ? "" : buildChoiceButtonsHtml(choices, row, graph);
  return `<div class="${wrapClass}">${question}<div class="phone-choice-count">${choices.length} choices</div>${buttonsHtml}</div>`;
}
function renderPhone(edges, graph) {
  classIndex = buildClassStyleIndex(codeBox.value);
  if (isPhoneShowingHistory()) {
    if (isPhoneAwaitingStartNode(edges)) {
      phoneDiagramBox.innerHTML = '<div id="phoneStartPrompt">Select a starting node to walk a path through that diagram</div>';
      return;
    }
  }
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
  const footerBox = phoneDiagramBox.querySelector("#phoneFooter");
  if (footerBox)
    footerBox.scrollTop = footerBox.scrollHeight;
  const hasClickedNode = state.phoneClickedNodeId !== null;
  if (hasClickedNode) {
    const isClickRecent = Date.now() - state.phoneClickedAtMs < PHONE_CLICKED_BORDER_MS;
    if (isClickRecent) {
      const clickedEl = phoneDiagramBox.querySelector(`[data-node-id="${state.phoneClickedNodeId}"]`);
      if (clickedEl)
        clickedEl.classList.add("phone-clicked");
    }
  }
}

// source-lines.ts
function measureSourceLines() {
  const style = getComputedStyle(codeBox);
  const mirror = document.createElement("div");
  mirror.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;width:${codeBox.clientWidth}px;padding:${style.padding};font:${style.font};line-height:${style.lineHeight};`;
  for (const line of codeBox.value.split(`
`)) {
    const lineEl = document.createElement("div");
    lineEl.textContent = line || " ";
    mirror.append(lineEl);
  }
  document.body.append(mirror);
  const tops = [];
  for (const lineEl of mirror.children)
    tops.push(lineEl.offsetTop);
  const end = mirror.offsetHeight;
  mirror.remove();
  return { tops, end };
}
function renderGutter(tops, end) {
  const content = document.createElement("div");
  content.style.height = end + "px";
  for (let i = 0;i < tops.length; i++) {
    const numberEl = document.createElement("span");
    numberEl.textContent = String(i + 1);
    numberEl.style.top = tops[i] + "px";
    content.append(numberEl);
  }
  sourceGutter.replaceChildren(content);
  sourceGutter.scrollTop = codeBox.scrollTop;
}
function findNodeLineIndex(lines, id) {
  for (let i = 0;i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const startsWithId = trimmed.startsWith(id);
    const isNodeDefinition = startsWithId && ["[", "{", "("].includes(trimmed.charAt(id.length));
    if (isNodeDefinition)
      return i;
  }
  return -1;
}
function renderSelectedLineBand(tops, end) {
  const id = state.selectedEditorNodeId;
  const lineIndex = id ? findNodeLineIndex(codeBox.value.split(`
`), id) : -1;
  const hasSelectedLine = lineIndex !== -1;
  if (!hasSelectedLine) {
    codeBox.style.backgroundImage = "none";
    return;
  }
  const top = tops[lineIndex];
  const isLastLine = lineIndex === tops.length - 1;
  const bottom = isLastLine ? end - parseFloat(getComputedStyle(codeBox).paddingBottom) : tops[lineIndex + 1];
  const band = "color-mix(in srgb, var(--select-stroke) 25%, transparent)";
  codeBox.style.backgroundImage = `linear-gradient(transparent ${top}px, ${band} ${top}px, ${band} ${bottom}px, transparent ${bottom}px)`;
}
function renderSourceLines() {
  const { tops, end } = measureSourceLines();
  renderGutter(tops, end);
  renderSelectedLineBand(tops, end);
}
function syncGutterScroll() {
  sourceGutter.scrollTop = codeBox.scrollTop;
}
codeBox.addEventListener("scroll", syncGutterScroll);
new ResizeObserver(renderSourceLines).observe(codeBox);

// render.ts
var outputPointerHeld = null;
function holdNewDrawingUntilPointerIsUp() {
  outputPointerHeld = new Promise((resolve) => {
    function endHold() {
      outputPointerHeld = null;
      resolve();
    }
    function endHoldAfterClick() {
      setTimeout(endHold, 0);
    }
    document.addEventListener("pointerup", endHoldAfterClick, { once: true, capture: true });
    document.addEventListener("pointercancel", endHoldAfterClick, { once: true, capture: true });
  });
}
outputBox.addEventListener("pointerdown", holdNewDrawingUntilPointerIsUp, true);
async function render() {
  renderSourceLines();
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
    const mainSource = buildSourceWithSizeWrappers(buildSourceWithCodeTags(moveClassLinesToEnd(state.functionsOnly ? filterToFunctions(codeBox.value) : codeBox.value)));
    const phoneEdges = state.functionsOnly ? parseEdges(filterToFunctions(codeBox.value)) : edges;
    const regularViewport = { left: outputBox.scrollLeft, top: outputBox.scrollTop };
    const myRenderId = state.renderId;
    const { svg: regularSvg } = await mermaid.render("diagram-" + state.renderId++, mainSource);
    await outputPointerHeld;
    if (state.renderId !== myRenderId + 1)
      return;
    const hasNodes = graph.nodes.size > 0;
    const scaleIsUnset = state.diagramScale === null;
    if (hasNodes) {
      if (scaleIsUnset)
        state.diagramScale = 1;
    }
    diagramBox.innerHTML = regularSvg;
    renderPhone(phoneEdges, graph);
    applyNodeTypeColors(graph);
    applyNoteDots(graph);
    renderEditorSelection();
    applyPathHighlight();
    if (hasNodes) {
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
    updateOffscreenArrowHeads();
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
var declinedDiskText = null;
var watchedDiagramName = null;
var pendingSaveCount = 0;
var saveVersion = 0;
function setLastSavedDiagramText(text) {
  lastSavedDiagramText = text;
}
function createDiagramWatcher(name, watchUrl = "/api/watch/" + encodeURIComponent(name), diskUrl = "/api/diagrams/" + encodeURIComponent(name)) {
  if (state.watcher)
    state.watcher.close();
  watchedDiagramName = name;
  declinedDiskText = null;
  const source = new EventSource(watchUrl);
  state.watcher = source;
  const refresh = async () => {
    const versionAtFetchStart = saveVersion;
    const saveInFlightAtFetchStart = pendingSaveCount > 0;
    const diagramResponse = await fetch(diskUrl);
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
      const hasUnsavedEdits = codeBox.value !== lastSavedDiagramText;
      if (hasUnsavedEdits) {
        if (text === declinedDiskText)
          return;
        const loadsDiskVersion = window.confirm("This file changed on disk. OK loads the disk version. Cancel keeps your unsaved edits.");
        if (!loadsDiskVersion) {
          declinedDiskText = text;
          return;
        }
      }
      applyTypeMetadata(splitEditorMetadata(text).metadata);
      codeBox.value = text;
      resetEditorHistory(text);
    }
    lastSavedDiagramText = text;
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
    pendingSaveCount++;
    saveVersion++;
    try {
      const openFileResponse = await fetch("/api/open-file?path=" + encodeURIComponent(state.loadedPath), { method: "PUT", body: codeBox.value });
      if (!openFileResponse.ok)
        throw new Error(await openFileResponse.text());
    } finally {
      pendingSaveCount--;
    }
    lastSavedDiagramText = codeBox.value;
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

// editor-rename.ts
var KIND_PREFIXES = { question: "Q_", block: "B_", choice: "Q_CHOICE_" };
var CHOICE_PREFIX = KIND_PREFIXES.choice;
function buildRenamePlan(graph, oldId, newId) {
  const node = graph.nodes.get(oldId);
  if (newId === "")
    return { error: "The identifier can not be empty." };
  if (!/^[A-Za-z0-9_]+$/.test(newId))
    return { error: "Use only letters, digits and _ in the identifier." };
  const prefix = KIND_PREFIXES[node.kind];
  const isQuestionWithChoicePrefix = node.kind === "question" && newId.startsWith(CHOICE_PREFIX);
  if (!newId.startsWith(prefix) || isQuestionWithChoicePrefix)
    return { error: `The identifier must start with ${prefix}` };
  if (newId === prefix)
    return { error: `Add a name after ${prefix}` };
  const renames = new Map;
  if (newId === oldId)
    return { renames };
  renames.set(oldId, newId);
  if (node.kind === "question") {
    const oldChoicePrefix = `${CHOICE_PREFIX}${oldId.slice(prefix.length)}_`;
    const newChoicePrefix = `${CHOICE_PREFIX}${newId.slice(prefix.length)}_`;
    for (const edge of graph.edges) {
      const isChoiceOfQuestion = edge.from === oldId && edge.to.startsWith(oldChoicePrefix);
      if (isChoiceOfQuestion)
        renames.set(edge.to, newChoicePrefix + edge.to.slice(oldChoicePrefix.length));
    }
  }
  for (const to of renames.values()) {
    const isUsed = graph.nodes.has(to);
    if (isUsed)
      return { error: `The identifier ${to} is already used.` };
  }
  return { renames };
}
function buildRenamedSource(source, renames) {
  const names = [...renames.keys()].map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const wordPattern = new RegExp(`(?<![A-Za-z0-9_])(?:${names.join("|")})(?![A-Za-z0-9_])`, "g");
  const lines = source.split(`
`);
  const renamedLines = [];
  for (const line of lines) {
    const isNoteLine = line.trimStart().startsWith(NOTE_PREFIX);
    renamedLines.push(isNoteLine ? line : line.replace(wordPattern, (word) => renames.get(word)));
  }
  return renamedLines.join(`
`);
}
function renameStateIds(renames) {
  const rename = (id) => id === null ? null : renames.get(id) ?? id;
  for (let i = 0;i < phonePath.length; i++)
    phonePath[i] = rename(phonePath[i]);
  state.selectedEditorNodeId = rename(state.selectedEditorNodeId);
  state.phoneStartNodeId = rename(state.phoneStartNodeId);
  state.phoneClickedNodeId = rename(state.phoneClickedNodeId);
  state.phoneFocusNodeId = rename(state.phoneFocusNodeId);
  state.phonePreviewChoiceId = rename(state.phonePreviewChoiceId);
  state.currentDecisionId = rename(state.currentDecisionId);
}
function getParentQuestionId(graph, choiceId) {
  for (const edge of graph.edges) {
    const isFromQuestion = edge.to === choiceId && graph.nodes.get(edge.from)?.kind === "question";
    if (isFromQuestion)
      return edge.from;
  }
  return;
}
function getNodeNamePart(graph, node) {
  if (node.kind !== "choice")
    return node.id.slice(KIND_PREFIXES[node.kind].length);
  const parentId = getParentQuestionId(graph, node.id);
  if (parentId === undefined)
    return node.id.slice(CHOICE_PREFIX.length);
  const parentPrefix = `${CHOICE_PREFIX}${parentId.slice(KIND_PREFIXES.question.length)}_`;
  const startsWithParentPrefix = node.id.startsWith(parentPrefix);
  return node.id.slice(startsWithParentPrefix ? parentPrefix.length : CHOICE_PREFIX.length);
}
function buildFullId(graph, node, name) {
  if (node.kind !== "choice")
    return `${KIND_PREFIXES[node.kind]}${name}`;
  const parentId = getParentQuestionId(graph, node.id);
  if (parentId === undefined)
    return `${CHOICE_PREFIX}${name}`;
  return `${CHOICE_PREFIX}${parentId.slice(KIND_PREFIXES.question.length)}_${name}`;
}
function checkNodeName(graph, node, name) {
  if (name === "")
    return { error: "error: node name cannot be empty" };
  const illegalCharacters = [];
  for (const character of name) {
    const isLegal = /[A-Za-z0-9_]/.test(character);
    const label = character === " " ? "space" : character;
    if (!isLegal && !illegalCharacters.includes(label))
      illegalCharacters.push(label);
  }
  if (illegalCharacters.length > 0)
    return { error: `error: node names cannot contain ${illegalCharacters.join(", ")}` };
  const fullId = buildFullId(graph, node, name);
  if (fullId === node.id)
    return { fullId };
  if (graph.nodes.has(fullId))
    return { error: `error: ${fullId} is already used` };
  const plan = buildRenamePlan(graph, node.id, fullId);
  if ("error" in plan)
    return { error: `error: ${plan.error}` };
  return { fullId };
}
function showNameCheck(check) {
  const isError = "error" in check;
  nodeNameCheck.textContent = isError ? check.error : `result: ${check.fullId}`;
  nodeNameCheck.classList.toggle("error", isError);
}
function checkTypedNodeName() {
  const node = getEditorGraph().nodes.get(state.selectedEditorNodeId ?? "");
  if (!node)
    return;
  showNameCheck(checkNodeName(getEditorGraph(), node, nodeNameInput.value));
}
function isNodeNameBoxInvalid() {
  if (nodeInspector.hidden)
    return false;
  const graph = getEditorGraph();
  const node = graph.nodes.get(state.selectedEditorNodeId ?? "");
  if (!node)
    return false;
  return "error" in checkNodeName(graph, node, nodeNameInput.value);
}
var hideNoticeTimer;
function refuseMoveWhileNodeNameIsInvalid() {
  if (!isNodeNameBoxInvalid())
    return false;
  inspectorNotice.textContent = "Fix the bad Node Name first.";
  inspectorNotice.hidden = false;
  clearTimeout(hideNoticeTimer);
  hideNoticeTimer = setTimeout(hideInspectorNotice, 4000);
  return true;
}
function hideInspectorNotice() {
  inspectorNotice.hidden = true;
}
function commitNodeName(oldId = state.selectedEditorNodeId, name = nodeNameInput.value) {
  if (!oldId)
    return;
  const graph = getEditorGraph();
  const node = graph.nodes.get(oldId);
  if (!node)
    return;
  const check = checkNodeName(graph, node, name);
  if ("error" in check) {
    const isStillSelected = state.selectedEditorNodeId === oldId;
    if (isStillSelected) {
      nodeNameInput.value = getNodeNamePart(graph, node);
      showNameCheck(check);
    }
    return;
  }
  renameNodeIdentifier(oldId, check.fullId);
}
function renameNodeIdentifier(oldId, newId) {
  if (!oldId)
    return;
  async function applyRename() {
    const graph = getEditorGraph();
    if (!graph.nodes.has(oldId))
      return;
    const plan = buildRenamePlan(graph, oldId, newId);
    if ("error" in plan) {
      const isStillSelected = state.selectedEditorNodeId === oldId;
      if (isStillSelected) {
        nodeNameInput.value = getNodeNamePart(graph, graph.nodes.get(oldId));
        showNameCheck({ error: `error: ${plan.error}` });
      }
      return;
    }
    if (plan.renames.size === 0)
      return;
    renameStateIds(plan.renames);
    await applyEditorSource(buildRenamedSource(codeBox.value, plan.renames));
  }
  appendEditorAction(applyRename);
}

// source-edit.ts
function buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines) {
  const removedWithNotes = new Set(removedLineIndexes);
  for (const removedIndex of removedLineIndexes) {
    for (let i = removedIndex - 1;i >= 0 && graph.lines[i].trim().startsWith(NOTE_PREFIX); i--)
      removedWithNotes.add(i);
  }
  const removedNodeIds = new Set;
  for (const node of graph.nodes.values()) {
    if (removedLineIndexes.has(node.lineIndex))
      removedNodeIds.add(node.id);
  }
  const deletedNodeIds = new Set;
  for (const id of removedNodeIds) {
    const idPattern = new RegExp(`(?<!\\w)${id}(?!\\w)`);
    const isDeclaredAgain = newLines.some((line) => idPattern.test(line));
    const isUsedByKeptEdge = graph.edges.some((edge) => !removedWithNotes.has(edge.lineIndex) && (edge.from === id || edge.to === id));
    if (!isDeclaredAgain && !isUsedByKeptEdge)
      deletedNodeIds.add(id);
  }
  const kept = [];
  for (let lineIndex = 0;lineIndex < graph.lines.length; lineIndex++) {
    const isRemoved = removedWithNotes.has(lineIndex);
    if (isRemoved)
      continue;
    const size = parseSizeLine(graph.lines[lineIndex]);
    const isSizeOfRemovedNode = !!size && deletedNodeIds.has(size.id);
    if (isSizeOfRemovedNode)
      continue;
    const align = parseAlignLine(graph.lines[lineIndex]);
    const isAlignOfRemovedNode = !!align && deletedNodeIds.has(align.id);
    if (isAlignOfRemovedNode)
      continue;
    const classMatch = graph.lines[lineIndex].match(CLASS_LINE_RE);
    if (!classMatch) {
      kept.push(graph.lines[lineIndex]);
      continue;
    }
    const namedIds = classMatch[2].split(",");
    const remainingIds = namedIds.filter((id) => !deletedNodeIds.has(id));
    if (remainingIds.length === namedIds.length) {
      kept.push(graph.lines[lineIndex]);
      continue;
    }
    if (remainingIds.length > 0)
      kept.push(`${classMatch[1]}class ${remainingIds.join(",")} ${classMatch[3]}`);
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
  for (const edge of graph.edges) {
    const isOnRemovedLine = removedLineIndexes.has(edge.lineIndex);
    const isKept = isOnRemovedLine && edge.from !== id;
    if (isKept) {
      const arrow = edge.label ? `-- "${edge.label}" -->` : "-->";
      newLines.push(`  ${edge.from} ${arrow} ${edge.to}`);
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

// inspector-resize.ts
var MAX_SHARE_OF_VIEW_AREA = 0.5;
var nodeInspectorResizeHandle = document.getElementById("nodeInspectorResizeHandle");
var extraHeight = 0;
function applyInspectorExtraHeight() {
  const sharedHeight = outputBox.getBoundingClientRect().height + nodeInspector.getBoundingClientRect().height;
  nodeInspector.style.height = "";
  const naturalHeight = nodeInspector.getBoundingClientRect().height;
  const maxExtraHeight = Math.max(0, sharedHeight * MAX_SHARE_OF_VIEW_AREA - naturalHeight);
  extraHeight = Math.min(extraHeight, maxExtraHeight);
  if (extraHeight > 0)
    nodeInspector.style.height = `${naturalHeight + extraHeight}px`;
}
function startInspectorResizeDrag(event) {
  event.preventDefault();
  const startY = event.clientY;
  const startExtraHeight = extraHeight;
  function growInspectorWithMouse(moveEvent) {
    extraHeight = Math.max(0, startExtraHeight + startY - moveEvent.clientY);
    applyInspectorExtraHeight();
  }
  function stopInspectorResizeDrag() {
    document.removeEventListener("mousemove", growInspectorWithMouse);
    document.removeEventListener("mouseup", stopInspectorResizeDrag);
  }
  document.addEventListener("mousemove", growInspectorWithMouse);
  document.addEventListener("mouseup", stopInspectorResizeDrag);
}
nodeInspectorResizeHandle.addEventListener("mousedown", startInspectorResizeDrag);

// destination-picker.ts
var highlightedIndex = -1;
function closeDestinationList() {
  destinationList.hidden = true;
  destinationInput.setAttribute("aria-expanded", "false");
  highlightedIndex = -1;
}
function showDestinationInInput() {
  closeDestinationList();
  destinationInput.value = destinationSelect.selectedOptions[0]?.text ?? "";
}
function showDestinationOptionsMatching(query) {
  const lowerCaseQuery = query.toLowerCase();
  const items = [];
  for (const option of destinationSelect.options) {
    const isMatch = option.text.toLowerCase().includes(lowerCaseQuery);
    if (!isMatch)
      continue;
    const item = document.createElement("div");
    item.setAttribute("role", "option");
    item.className = "destination-option";
    item.dataset.value = option.value;
    item.textContent = option.text;
    items.push(item);
  }
  destinationList.replaceChildren(...items);
  highlightedIndex = -1;
  destinationList.hidden = false;
  destinationInput.setAttribute("aria-expanded", "true");
}
function highlightDestinationItem(index) {
  const items = [...destinationList.children];
  highlightedIndex = Math.min(Math.max(index, 0), items.length - 1);
  items.forEach((item, itemIndex) => item.setAttribute("aria-selected", String(itemIndex === highlightedIndex)));
  items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
}
function pickDestination(value) {
  closeDestinationList();
  destinationSelect.value = value;
  destinationSelect.dispatchEvent(new Event("change", { bubbles: true }));
}
function openDestinationListOnClick() {
  if (!destinationList.hidden)
    return;
  destinationInput.select();
  showDestinationOptionsMatching("");
}
function filterDestinationListOnTyping() {
  showDestinationOptionsMatching(destinationInput.value);
}
function moveOrPickDestinationOnKey(event) {
  if (event.key === "Escape") {
    showDestinationInInput();
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (destinationList.hidden)
      showDestinationOptionsMatching("");
    highlightDestinationItem(highlightedIndex + 1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    highlightDestinationItem(highlightedIndex - 1);
    return;
  }
  if (event.key === "Enter") {
    const item = destinationList.children[highlightedIndex];
    if (!item)
      return;
    event.preventDefault();
    pickDestination(item.dataset.value);
  }
}
function pickDestinationOnItemClick(event) {
  const item = event.target.closest(".destination-option");
  if (!item)
    return;
  pickDestination(item.dataset.value);
}
function keepInputFocusOnListMouseDown(event) {
  event.preventDefault();
}
function closeDestinationListOnOutsideMouseDown(event) {
  if (destinationList.hidden)
    return;
  const isInsidePicker = event.target.closest("#destinationRow");
  if (isInsidePicker)
    return;
  showDestinationInInput();
}
destinationInput.addEventListener("click", openDestinationListOnClick);
destinationInput.addEventListener("input", filterDestinationListOnTyping);
destinationInput.addEventListener("keydown", moveOrPickDestinationOnKey);
destinationList.addEventListener("mousedown", keepInputFocusOnListMouseDown);
destinationList.addEventListener("click", pickDestinationOnItemClick);
document.addEventListener("mousedown", closeDestinationListOnOutsideMouseDown);

// node-inspector.ts
function replaceDeclarationInLine(line, id, newToken) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escapedId}(\\{\\{"[^"]*"\\}\\}|\\{"[^"]*"\\}|\\["[^"]*"\\]|\\{\\{[^}]*\\}\\}|\\{[^}]*\\}|\\[[^\\]]*\\]|\\(\\[[^\\]]*\\]\\))`);
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
    decisionShapeRow.hidden = true;
    nodeAlignRow.hidden = true;
    nodeTextInput.value = "";
    nodeNotesInput.value = "";
    clearInspectorFocus();
    return;
  }
  const previewing = !!state.pendingRemoval;
  nodeInspectorTitle.textContent = INSPECTOR_TITLES[node.kind];
  nodeTextInput.value = decodeLabelLineBreaks(decodeLabelQuotes(node.label));
  nodeKindStaticBox.checked = node.kind === "block";
  nodeKindQuestionBox.checked = node.kind === "question";
  nodeKindChoiceBox.checked = node.kind === "choice";
  decisionShapeRow.hidden = node.kind !== "question";
  decisionShapeSwitch.checked = !node.isHexagon;
  const parentId = getParentQuestionId(graph, node.id);
  const parentText = parentId === undefined ? "parent: none" : `- parent: ${parentId}`;
  nodeParentLabel.textContent = node.kind === "choice" ? parentText : "";
  nodeNameInput.value = getNodeNamePart(graph, node);
  showNameCheck({ fullId: node.id });
  nodeNotesInput.value = decodeLabelLineBreaks(node.note);
  const nodeAlign = getNodeAlign(graph.lines, node.id);
  nodeTextInput.style.textAlign = nodeAlign.justification;
  for (const button of nodeAlignRow.querySelectorAll("button")) {
    const isJustificationPressed = button.dataset.justification === nodeAlign.justification;
    const isAlignmentPressed = button.dataset.alignment === nodeAlign.alignment;
    button.setAttribute("aria-pressed", String(isJustificationPressed || isAlignmentPressed));
  }
  nodeClassRow.hidden = previewing;
  nodeAlignRow.hidden = previewing;
  nodeNotesRow.hidden = previewing;
  if (!previewing)
    renderClassPicker(node);
  nodeInspectorRemovalPreview.hidden = !previewing;
  nodeInspectorActions.hidden = previewing;
  walkBackBtn.hidden = previewing;
  nodeInspectorControls.hidden = previewing;
  if (previewing) {
    applyInspectorExtraHeight();
    updateNodeInspectorPosition();
    return;
  }
  const hasParent = graph.edges.some((edge) => edge.to === node.id);
  walkBackBtn.disabled = !hasParent;
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
      destinationSelect.add(new Option(`${getOneLineLabel(candidate.label)} (${candidate.id})`, candidate.id));
    }
    destinationSelect.value = destination ?? "";
    nodeInspectorDismissBtn.textContent = destination ? "Cancel" : "Close";
  } else {
    nodeInspectorDismissBtn.textContent = "Cancel";
  }
  showDestinationInInput();
  applyInspectorExtraHeight();
  updateNodeInspectorPosition();
}

// node-search.ts
var searchMatches = [];
var searchIndex = 0;
var searchRunId = 0;
function findSourceMatches(query) {
  const matches = [];
  if (query === "")
    return matches;
  const needle = query.toLowerCase();
  const haystack = codeBox.value.toLowerCase();
  let start = haystack.indexOf(needle);
  while (start !== -1) {
    matches.push({ start, end: start + needle.length });
    start = haystack.indexOf(needle, start + needle.length);
  }
  return matches;
}
function findNodeIdAtMatch(graph, match) {
  const source = codeBox.value;
  const lineStart = source.lastIndexOf(`
`, match.start - 1) + 1;
  const newlineAfter = source.indexOf(`
`, match.start);
  const lineEnd = newlineAfter === -1 ? source.length : newlineAfter;
  const line = source.slice(lineStart, lineEnd);
  const matchOffset = match.start - lineStart;
  const sizeLine = parseSizeLine(line);
  if (sizeLine) {
    const isNode = graph.nodes.has(sizeLine.id);
    if (isNode)
      return sizeLine.id;
  }
  const parts = [];
  let partStart = 0;
  const arrows = [...line.matchAll(/-->|---|==>|-\.->/g)];
  const partEnds = [...arrows.map((arrow) => arrow.index), line.length];
  for (let i = 0;i < partEnds.length; i++) {
    const partText = line.slice(partStart, partEnds[i]);
    const idMatch = partText.match(/^\s*(?:\|[^|]*\|)?\s*([A-Za-z_][A-Za-z0-9_]*)/);
    if (idMatch) {
      const isNode = graph.nodes.has(idMatch[1]);
      if (isNode)
        parts.push({ id: idMatch[1], start: partStart, end: partEnds[i] });
    }
    if (i < arrows.length)
      partStart = arrows[i].index + arrows[i][0].length;
  }
  for (const part of parts) {
    const isMatchInsidePart = matchOffset >= part.start && matchOffset < part.end;
    if (isMatchInsidePart)
      return part.id;
  }
  return parts[0]?.id;
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
function showMatchInSourceEditor(match) {
  const isDrawerClosed = drawer.classList.contains("closed");
  if (isDrawerClosed)
    drawerToggle.click();
  codeBox.setSelectionRange(match.start, match.end);
  const lineIndex = codeBox.value.slice(0, match.start).split(`
`).length - 1;
  const { tops } = measureSourceLines();
  codeBox.scrollTop = tops[lineIndex] - parseFloat(getComputedStyle(codeBox).paddingTop);
}
async function moveToSearchMatch() {
  const runId = ++searchRunId;
  const match = searchMatches[searchIndex];
  showMatchInSourceEditor(match);
  const { graph, problems } = parseEditorGraph(codeBox.value);
  const hasParseError = problems.length > 0;
  if (hasParseError)
    return;
  const id = findNodeIdAtMatch(graph, match);
  if (!id)
    return;
  selectEditorNode(id);
  await render();
  if (runId !== searchRunId)
    return;
  selectEditorNode(id);
  moveNodeToViewportCenter(outputBox, diagramBox, id);
}
async function executeSearch() {
  searchMatches = findSourceMatches(searchInput.value);
  searchIndex = 0;
  updateSearchControls();
  if (searchMatches.length === 0)
    return;
  await moveToSearchMatch();
}
function refreshSearchMatches() {
  searchMatches = findSourceMatches(searchInput.value);
  searchIndex = Math.min(searchIndex, Math.max(searchMatches.length - 1, 0));
  updateSearchControls();
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
  refreshSearchMatches();
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
  state.multiSelectedNodeIds = [];
  if (state.advanceAfterDecisionText?.decisionId !== id)
    state.advanceAfterDecisionText = null;
  if (state.focusDestinationAfterTextId !== id)
    state.focusDestinationAfterTextId = null;
  state.pendingRemoval = null;
  nodeActions.classList.remove("removing");
  nodeActions.classList.toggle("open", !!id);
  selectedNodeBox.textContent = id ?? "";
  renderSourceLines();
  renderEditorSelection();
  renderNodeInspector();
}
function renderEditorSelection() {
  for (const el of diagramBox.querySelectorAll(".editor-selected"))
    el.classList.remove("editor-selected");
  for (const el of diagramBox.querySelectorAll(".editor-preview"))
    el.classList.remove("editor-preview");
  multiSelectBadge.hidden = state.multiSelectedNodeIds.length < 2;
  multiSelectBadge.textContent = `selected: ${state.multiSelectedNodeIds.length} nodes`;
  const selectedIds = state.selectedEditorNodeId ? [state.selectedEditorNodeId] : state.multiSelectedNodeIds;
  for (const selectedId of selectedIds) {
    const el = diagramBox.querySelector('[id*="flowchart-' + selectedId + '-"]');
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
  const nodeCenterX = outputBox.scrollLeft + nodeRect.left + nodeRect.width / 2 - outputRect.left;
  const nodeTop = outputBox.scrollTop + nodeRect.top - outputRect.top;
  if (!hasSavedLeft)
    outputBox.scrollLeft = Math.max(0, nodeCenterX - outputBox.clientWidth / 2);
  if (!hasSavedTop)
    outputBox.scrollTop = Math.max(0, nodeTop - 12);
}

// error-line-links.ts
function selectSourceLine(lineNumber) {
  const lines = codeBox.value.split(`
`);
  let start = 0;
  for (let i = 0;i < lineNumber - 1; i++)
    start += lines[i].length + 1;
  setDrawerOpen(true);
  const { tops } = measureSourceLines();
  codeBox.scrollTop = tops[lineNumber - 1] - parseFloat(getComputedStyle(codeBox).paddingTop);
  codeBox.focus({ preventScroll: true });
  codeBox.setSelectionRange(start, start + lines[lineNumber - 1].length);
}
function renderErrorMessageWithLineLinks(element, message) {
  const pieces = [];
  for (const part of message.split(/(Line \d+)/)) {
    const lineMatch = part.match(/^Line (\d+)$/);
    if (!lineMatch) {
      pieces.push(part);
      continue;
    }
    const lineNumber = Number(lineMatch[1]);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "error-line-link";
    button.dataset.line = String(lineNumber);
    button.textContent = part;
    button.addEventListener("click", () => selectSourceLine(lineNumber));
    pieces.push(button);
  }
  element.replaceChildren(...pieces);
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
  renderErrorMessageWithLineLinks(errorBox, message);
  renderErrorMessageWithLineLinks(errorLog, message + `
`);
  errorLog.classList.add("open");
  errorLog.scrollTop = errorLog.scrollHeight;
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
    `  ${qId}{{"New question"}}`,
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
  moveNodeToViewportCenter(outputBox, diagramBox, staticId);
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
    `  ${decisionId}{{"New Decision"}}`,
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
  moveNodeToViewportCenter(outputBox, diagramBox, decisionId);
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
  selectEditorNode(cid);
  moveNodeToViewportCenter(outputBox, diagramBox, cid);
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
    `  ${decisionId}{{"New Decision"}}`,
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
  const appliedSource = applyEditorSource(buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines));
  setEditorActionPromise(appliedSource.then(() => moveNodeToViewportCenter(outputBox, diagramBox, decisionId)));
}

// editor-remove.ts
function removeChoice() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const newSource = buildChoiceRemovedSource(graph, state.selectedEditorNodeId);
  selectEditorNode(null);
  setEditorActionPromise(applyEditorSource(newSource));
}
function buildChoiceRemovedSource(graph, id) {
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
  return buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines);
}
function removeBlock() {
  if (!state.selectedEditorNodeId)
    return;
  const graph = getEditorGraph();
  const newSource = buildBlockRemovedSource(graph, state.selectedEditorNodeId);
  selectEditorNode(null);
  setEditorActionPromise(applyEditorSource(newSource));
}
function buildBlockRemovedSource(graph, id) {
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
  return buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines);
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
  state.pendingRemoval = { questionId, choices, index: 0 };
  const hasNoChoices = !choices.length;
  if (hasNoChoices) {
    applyQuestionRemoval();
    return;
  }
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
  if (!choices.length)
    selectEditorNode(null);
  const newSource = buildQuestionRemovedSource(graph, questionId, choices, index);
  function applyRemovedQuestionSource() {
    return applyEditorSource(newSource);
  }
  executeEditorAction(applyRemovedQuestionSource);
}
function buildQuestionRemovedSource(graph, questionId, choices, index) {
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
  if (keepSuccessor) {
    for (const predecessor of predecessors)
      newLines.push(`  ${predecessor} --> ${keepSuccessor}`);
  }
  return buildSourceWithLinesReplaced(graph, removedLineIndexes, newLines);
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
  sessionStorage.setItem("tabOpenedFile", JSON.stringify({ name }));
  state.openedFileHandle = null;
  statusBox.textContent = state.loadedPath ?? "";
  phonePath.length = 0;
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  state.phoneStartNodeId = null;
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

// open-file.ts
async function openFileFromDialog() {
  const openResponse = await fetch("/api/open-file");
  if (openResponse.status === 204) {
    console.log("User canceled Open File");
    return;
  }
  const { path, text } = await openResponse.json();
  showOpenedFile(path, text);
}
async function showOpenedFile(path, text) {
  if (state.watcher) {
    state.watcher.close();
    state.watcher = null;
  }
  state.currentName = null;
  state.openedFileHandle = null;
  state.loadedPath = path;
  statusBox.textContent = path;
  state.pathFolderHandle = null;
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  state.phoneStartNodeId = null;
  state.diagramScale = null;
  const { metadata } = splitEditorMetadata(text);
  state.currentDecisionId = metadata?.lastSelectedNodeId ?? null;
  state.mainZoomPercent = metadata?.mainZoomPercent ?? 100;
  codeBox.value = text;
  applyTypeMetadata(metadata);
  resetEditorHistory(codeBox.value);
  selectBox.value = "";
  await render();
  applyMainZoom(false);
  loadList();
  setDrawerOpen(true);
  setLastSavedDiagramText(text);
  sessionStorage.setItem("tabOpenedFile", JSON.stringify({ path }));
  createDiagramWatcher(path, "/api/watch-opened?path=" + encodeURIComponent(path), "/api/opened-file?path=" + encodeURIComponent(path));
  const graph = getEditorGraph();
  if (graph.nodes.has(metadata?.lastSelectedNodeId ?? ""))
    selectEditorNode(metadata.lastSelectedNodeId);
  applyMainViewport(metadata, graph);
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
  return decodeLabelQuotes(graph.nodes.get(id).label).replace(/<br\s*\/?>/gi, " ");
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
  for (const id of declaredIds) {
    const size = graph.nodes.get(id).size;
    if (size)
      lines.push(buildSizeLine(id, size.width, size.height));
  }
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
  const startNodes = findRoots(edges);
  const allPaths = [];
  for (const startNode of startNodes) {
    const paths = [];
    collectPaths([startNode], new Set, edges, paths);
    allPaths.push(...paths);
  }
  return allPaths;
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
function disableDiagramEdits() {
  document.getElementById("newBtn").disabled = true;
  openFileBtn.disabled = true;
  selectBox.disabled = true;
  classesMenuBtn.disabled = true;
  document.getElementById("editorUndoBtn").disabled = true;
  document.getElementById("editorRedoBtn").disabled = true;
  nodeActions.inert = true;
  nodeTextInput.inert = true;
  nodeClassRow.inert = true;
  nodeAlignRow.inert = true;
  nodeInspectorActions.inert = true;
  destinationRow.inert = true;
  nodeInspectorRemovalPreview.inert = true;
  phoneDiagramBox.classList.add("writing-all-paths");
  codeBox.readOnly = true;
  document.getElementById("exportAllPathsBtn").disabled = true;
}
function enableDiagramEdits() {
  document.getElementById("newBtn").disabled = false;
  openFileBtn.disabled = false;
  selectBox.disabled = false;
  classesMenuBtn.disabled = false;
  document.getElementById("editorUndoBtn").disabled = false;
  document.getElementById("editorRedoBtn").disabled = false;
  nodeActions.inert = false;
  nodeTextInput.inert = false;
  nodeClassRow.inert = false;
  nodeAlignRow.inert = false;
  nodeInspectorActions.inert = false;
  destinationRow.inert = false;
  nodeInspectorRemovalPreview.inert = false;
  phoneDiagramBox.classList.remove("writing-all-paths");
  codeBox.readOnly = false;
  document.getElementById("exportAllPathsBtn").disabled = false;
}
async function writeAllPathsWithEditsDisabled() {
  disableDiagramEdits();
  try {
    await writeAllPaths();
  } finally {
    enableDiagramEdits();
  }
}
document.getElementById("exportAllPathsBtn").addEventListener("click", writeAllPathsWithEditsDisabled);

// editor-node-size.ts
function setNodeSize(id, width, height) {
  async function applyNodeSize() {
    await applyEditorSource(buildSourceWithNodeSize(codeBox.value, id, width, height));
  }
  appendEditorAction(applyNodeSize);
}
function resetNodeSize(id) {
  async function applyAutomaticSize() {
    const hasSizeLine = codeBox.value.split(`
`).some((line) => parseSizeLine(line)?.id === id);
    if (!hasSizeLine)
      return;
    await applyEditorSource(buildSourceWithoutNodeSize(codeBox.value, id));
  }
  appendEditorAction(applyAutomaticSize);
}

// editor-view-state.ts
async function saveEditorViewState() {
  const hasSaveTarget = !!state.currentName || !!state.openedFileHandle || !!state.loadedPath;
  if (!hasSaveTarget)
    return;
  const sourceWithMetadata = buildSourceWithMetadata(codeBox.value);
  if (sourceWithMetadata === codeBox.value)
    return;
  const { scrollTop, selectionStart, selectionEnd } = codeBox;
  codeBox.value = sourceWithMetadata;
  codeBox.scrollTop = scrollTop;
  codeBox.setSelectionRange(selectionStart, selectionEnd);
  renderSourceLines();
  await saveDiagram();
}

// editor-connect.ts
function connectNodesWithShiftClick(clickedId) {
  const fromId = state.selectedEditorNodeId;
  if (!fromId) {
    selectEditorNode(clickedId);
    return;
  }
  if (fromId === clickedId)
    return;
  const graph = getEditorGraph();
  const newLines = [`  ${fromId} --> ${clickedId}`];
  setEditorActionPromise(applyEditorSource(buildSourceWithLinesReplaced(graph, new Set, newLines)));
}

// editor-multiselect.ts
function getSelectedNodeIds() {
  if (state.multiSelectedNodeIds.length)
    return state.multiSelectedNodeIds;
  if (state.selectedEditorNodeId)
    return [state.selectedEditorNodeId];
  return [];
}
function toggleNodeInSelection(id) {
  const currentIds = getSelectedNodeIds();
  const nextIds = currentIds.includes(id) ? currentIds.filter((currentId) => currentId !== id) : [...currentIds, id];
  if (nextIds.length <= 1) {
    selectEditorNode(nextIds[0] ?? null);
    return;
  }
  selectEditorNode(null);
  state.multiSelectedNodeIds = nextIds;
  renderEditorSelection();
}

// editor-keys.ts
function isTextBoxTarget(target) {
  const element = target;
  const isInput = element.tagName === "INPUT";
  const isTextarea = element.tagName === "TEXTAREA";
  const isSelect = element.tagName === "SELECT";
  return isInput || isTextarea || isSelect || element.isContentEditable;
}
function isDiagramViewTarget(target) {
  return target === document.body || outputBox.contains(target);
}
function buildSourceWithNodesRemoved(ids) {
  let source = codeBox.value;
  for (const id of ids) {
    const { graph, problems } = parseEditorGraph(source);
    if (problems.length)
      throw new Error(problems.join("; "));
    const node = graph.nodes.get(id);
    if (!node)
      continue;
    if (node.kind === "question") {
      const choices = graph.edges.filter((edge) => edge.from === id).map((edge) => edge.to);
      source = buildQuestionRemovedSource(graph, id, choices, 0);
    } else if (node.kind === "choice")
      source = buildChoiceRemovedSource(graph, id);
    else
      source = buildBlockRemovedSource(graph, id);
  }
  return source;
}
function removeSelectedNodesOnDeleteKey(event) {
  const isDeleteKey = event.key === "Delete" || event.key === "Backspace";
  if (!isDeleteKey)
    return;
  if (!isDiagramViewTarget(event.target))
    return;
  const selectedIds = [...getSelectedNodeIds()];
  if (!selectedIds.length)
    return;
  event.preventDefault();
  const newSource = buildSourceWithNodesRemoved(selectedIds);
  selectEditorNode(null);
  executeEditorAction(() => applyEditorSource(newSource));
}
document.addEventListener("keydown", removeSelectedNodesOnDeleteKey);
function runUndoRedoOnCmdZ(event) {
  if (!event.metaKey)
    return;
  if (event.key.toLowerCase() !== "z")
    return;
  if (isTextBoxTarget(event.target))
    return;
  event.preventDefault();
  if (event.shiftKey)
    applyEditorRedo();
  else
    applyEditorUndo();
}
document.addEventListener("keydown", runUndoRedoOnCmdZ);
function saveOnCmdS(event) {
  if (!event.metaKey)
    return;
  if (event.key.toLowerCase() !== "s")
    return;
  event.preventDefault();
  document.getElementById("saveBtn").click();
}
document.addEventListener("keydown", saveOnCmdS);
function focusSearchOnCmdF(event) {
  if (!event.metaKey)
    return;
  if (event.key.toLowerCase() !== "f")
    return;
  event.preventDefault();
  searchInput.focus();
  searchInput.select();
}
document.addEventListener("keydown", focusSearchOnCmdF);
function zoomOnCmdPlusMinus(event) {
  if (!event.metaKey)
    return;
  const isZoomIn = event.key === "+" || event.key === "=";
  const isZoomOut = event.key === "-";
  if (isZoomIn) {
    event.preventDefault();
    zoomInBtn.click();
  } else if (isZoomOut) {
    event.preventDefault();
    zoomOutBtn.click();
  }
}
document.addEventListener("keydown", zoomOnCmdPlusMinus);
function selectNeighborNodeOnArrowKey(event) {
  const isArrowUp = event.key === "ArrowUp";
  const isArrowDown = event.key === "ArrowDown";
  if (!isArrowUp && !isArrowDown)
    return;
  if (!isDiagramViewTarget(event.target))
    return;
  const selectedId = state.selectedEditorNodeId;
  if (!selectedId)
    return;
  if (refuseMoveWhileNodeNameIsInvalid())
    return;
  const { graph, problems } = parseEditorGraph(codeBox.value);
  if (problems.length)
    throw new Error(problems.join("; "));
  const neighborEdge = isArrowDown ? graph.edges.find((edge) => edge.from === selectedId) : graph.edges.find((edge) => edge.to === selectedId);
  if (!neighborEdge)
    return;
  event.preventDefault();
  const neighborId = isArrowDown ? neighborEdge.to : neighborEdge.from;
  selectEditorNode(neighborId);
  moveNodeToViewportCenter(outputBox, diagramBox, neighborId);
  saveEditorViewState();
}
document.addEventListener("keydown", selectNeighborNodeOnArrowKey);
function moveToQuestionOnAngleBracket(event) {
  const isNext = event.key === ">";
  const isPrevious = event.key === "<";
  if (!isNext && !isPrevious)
    return;
  if (isTextBoxTarget(event.target))
    return;
  event.preventDefault();
  if (isNext)
    nextDecisionBtn.click();
  else
    previousDecisionBtn.click();
}
document.addEventListener("keydown", moveToQuestionOnAngleBracket);

// editor-commit.ts
function updateDecisionShape(id, isHexagon) {
  if (!id)
    return;
  async function applyDecisionShapeUpdate() {
    const graph = getEditorGraph();
    const node = graph.nodes.get(id);
    if (!node)
      return;
    const newToken = isHexagon ? `${id}{{"${node.label}"}}` : `${id}{"${node.label}"}`;
    const lines = graph.lines.slice();
    lines[node.lineIndex] = replaceDeclarationInLine(lines[node.lineIndex], id, newToken);
    const newSource = lines.join(`
`);
    await applyEditorSource(isHexagon ? newSource : buildSourceWithoutNodeSize(newSource, id));
  }
  appendEditorAction(applyDecisionShapeUpdate);
}
function updateNodeNote(id = state.selectedEditorNodeId, text = nodeNotesInput.value.trim()) {
  if (!id)
    return;
  async function applyNodeNoteUpdate() {
    const graph = getEditorGraph();
    const node = graph.nodes.get(id);
    if (!node || decodeLabelLineBreaks(node.note) === text)
      return;
    const oldCount = node.note ? node.note.split(`
`).length : 0;
    const lines = graph.lines.slice();
    const indent = lines[node.lineIndex].match(/^\s*/)[0];
    const newNoteLines = text ? [`${indent}${NOTE_PREFIX} ${encodeLabelLineBreaks(text, node.note)}`] : [];
    lines.splice(node.lineIndex - oldCount, oldCount, ...newNoteLines);
    await applyEditorSource(lines.join(`
`));
  }
  appendEditorAction(applyNodeNoteUpdate);
}
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
    const sourceText = encodeLabelLineBreaks(encodeLabelQuotes(text), node.label);
    if (node.label !== sourceText) {
      const decisionToken = node.isHexagon ? `${id}{{"${sourceText}"}}` : `${id}{"${sourceText}"}`;
      const newToken = node.kind === "question" ? decisionToken : `${id}["${sourceText}"]`;
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
  if (encodeLabelLineBreaks(encodeLabelQuotes(text), node.label) !== node.label)
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
    const centeredId = createsDecision ? state.selectedEditorNodeId : id;
    moveNodeToViewportCenter(outputBox, diagramBox, centeredId);
  }
  appendEditorAction(applyDestinationChange);
}
function applyDestinationSelection() {
  applyDestination(destinationSelect.value);
}

// editor-node-align.ts
function setNodeJustification(id, justification) {
  async function applyNodeJustification() {
    const stored = getNodeAlign(codeBox.value.split(`
`), id);
    if (stored.justification === justification)
      return;
    await applyEditorSource(buildSourceWithNodeAlign(codeBox.value, id, justification, stored.alignment));
  }
  appendEditorAction(applyNodeJustification);
}
function setNodeAlignment(id, alignment) {
  async function applyNodeAlignment() {
    const stored = getNodeAlign(codeBox.value.split(`
`), id);
    if (stored.alignment === alignment)
      return;
    await applyEditorSource(buildSourceWithNodeAlign(codeBox.value, id, stored.justification, alignment));
  }
  appendEditorAction(applyNodeAlignment);
}

// editor-inspector-events.ts
function isPointInsideLabelText(nodeEl, x, y) {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  const walker = document.createTreeWalker(nodeEl.querySelector(".nodeLabel"), NodeFilter.SHOW_TEXT);
  for (let current = walker.nextNode();current; current = walker.nextNode()) {
    const range = document.createRange();
    range.selectNodeContents(current);
    for (const rect of range.getClientRects()) {
      if (rect.width === 0)
        continue;
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
      top = Math.min(top, rect.top);
      bottom = Math.max(bottom, rect.bottom);
    }
  }
  return x >= left && x <= right && y >= top && y <= bottom;
}
var firstPress = null;
function rememberFirstPress(event) {
  if (event.detail !== 1)
    return;
  const nodeEl = event.target.closest("g.node");
  if (!nodeEl)
    return;
  firstPress = { nodeId: getNodeId(nodeEl), isOnText: isPointInsideLabelText(nodeEl, event.clientX, event.clientY) };
}
outputBox.addEventListener("mousedown", rememberFirstPress, true);
function openNodeTextEditor(event) {
  const nodeEl = event.target.closest("g.node");
  if (!nodeEl)
    return;
  if (refuseMoveWhileNodeNameIsInvalid())
    return;
  const isOnText = firstPress?.nodeId === getNodeId(nodeEl) ? firstPress.isOnText : isPointInsideLabelText(nodeEl, event.clientX, event.clientY);
  firstPress = null;
  if (!isOnText) {
    resetNodeSize(getNodeId(nodeEl));
    return;
  }
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
function walkBackFromSelectedNode() {
  const graph = getEditorGraph();
  const parentIds = [...new Set(graph.edges.filter((edge) => edge.to === state.selectedEditorNodeId).map((edge) => edge.from))];
  const hasOneParent = parentIds.length === 1;
  if (hasOneParent) {
    selectEditorNode(parentIds[0]);
    return;
  }
  const choiceButtons = parentIds.map((id) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "phone-choice";
    button.dataset.nodeId = id;
    button.textContent = getOneLineLabel(graph.nodes.get(id).label);
    return button;
  });
  walkBackChoices.replaceChildren(...choiceButtons);
  walkBackDialog.showModal();
}
walkBackBtn.addEventListener("click", walkBackFromSelectedNode);
function selectWalkBackChoice(event) {
  const button = event.target.closest("button[data-node-id]");
  if (!button)
    return;
  walkBackDialog.close();
  selectEditorNode(button.dataset.nodeId);
}
walkBackChoices.addEventListener("click", selectWalkBackChoice);
function closeWalkBackDialog() {
  walkBackDialog.close();
}
walkBackCancelBtn.addEventListener("click", closeWalkBackDialog);
function writeNodeTextOnCommitKey(event) {
  const isEnter = event.key === "Enter";
  const isTab = event.key === "Tab";
  const isCommitKey = isEnter || isTab;
  if (!isCommitKey)
    return;
  const isShiftEnter = isEnter && event.shiftKey;
  if (isShiftEnter)
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
function changeDecisionShapeOnSwitch() {
  updateDecisionShape(state.selectedEditorNodeId, !decisionShapeSwitch.checked);
}
decisionShapeSwitch.addEventListener("change", changeDecisionShapeOnSwitch);
function setNodeAlignOnButtonClick(event) {
  const button = event.target.closest("button");
  if (!button)
    return;
  const id = state.selectedEditorNodeId;
  if (!id)
    return;
  const { justification, alignment } = button.dataset;
  if (justification)
    setNodeJustification(id, justification);
  if (alignment)
    setNodeAlignment(id, alignment);
}
nodeAlignRow.addEventListener("click", setNodeAlignOnButtonClick);
function renameNodeOnCommitKey(event) {
  const isCommitKey = event.key === "Enter" || event.key === "Tab";
  if (!isCommitKey)
    return;
  event.preventDefault();
  commitNodeName();
}
nodeNameInput.addEventListener("keydown", renameNodeOnCommitKey);
function forceNodeNameFormat() {
  const { selectionStart, selectionEnd } = nodeNameInput;
  nodeNameInput.value = nodeNameInput.value.toUpperCase().replace(/ /g, "_");
  nodeNameInput.setSelectionRange(selectionStart, selectionEnd);
}
nodeNameInput.addEventListener("input", forceNodeNameFormat);
nodeNameInput.addEventListener("input", checkTypedNodeName);
function renameNodeOnChange() {
  if (isNodeNameBoxInvalid())
    return;
  const id = state.selectedEditorNodeId;
  const text = nodeNameInput.value;
  if (!isPointerPressed) {
    commitNodeName(id, text);
    return;
  }
  function renameNodeLater() {
    commitNodeName(id, text);
  }
  function scheduleRenameAfterClick() {
    setTimeout(renameNodeLater);
  }
  document.addEventListener("pointerup", scheduleRenameAfterClick, { once: true });
}
nodeNameInput.addEventListener("change", renameNodeOnChange);
function writeNodeNoteOnChange() {
  const id = state.selectedEditorNodeId;
  const text = nodeNotesInput.value.trim();
  if (!isPointerPressed) {
    updateNodeNote(id, text);
    return;
  }
  function writeNodeNoteLater() {
    updateNodeNote(id, text);
  }
  function scheduleNoteCommitAfterClick() {
    setTimeout(writeNodeNoteLater);
  }
  document.addEventListener("pointerup", scheduleNoteCommitAfterClick, { once: true });
}
nodeNotesInput.addEventListener("change", writeNodeNoteOnChange);
function writeNodeNoteOnEnter(event) {
  if (event.key !== "Enter")
    return;
  if (event.shiftKey)
    return;
  event.preventDefault();
  updateNodeNote();
}
nodeNotesInput.addEventListener("keydown", writeNodeNoteOnEnter);
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
function placeClassPickerListInsideWindow() {
  classPickerList.style.maxHeight = "none";
  const listHeight = classPickerList.scrollHeight + 2;
  const buttonRect = classPickerBtn.getBoundingClientRect();
  const spaceAbove = buttonRect.top - 8;
  const spaceBelow = window.innerHeight - buttonRect.bottom - 8;
  let opensUpward = spaceAbove >= spaceBelow;
  if (listHeight <= spaceAbove)
    opensUpward = true;
  classPickerList.style.top = opensUpward ? "auto" : "100%";
  classPickerList.style.bottom = opensUpward ? "100%" : "auto";
  classPickerList.style.maxHeight = `${Math.max(opensUpward ? spaceAbove : spaceBelow, 0)}px`;
}
function toggleClassPickerList() {
  classPickerList.hidden = !classPickerList.hidden;
  if (!classPickerList.hidden)
    placeClassPickerListInsideWindow();
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
    try {
      await createClass(name, classEditorFill.value, classEditorStroke.value);
      if (assignToNodeId)
        await setNodeClass(assignToNodeId, name);
    } finally {
      if (classesDialog.open)
        renderClassesDialog();
    }
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
    setEditorActionPromise(setClassColors(name, fill, stroke).finally(renderClassesDialog));
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
    setEditorActionPromise(renameClass(name, newName).finally(renderClassesDialog));
  }
}
function removeClassFromRow(event) {
  const button = event.target.closest(".classes-delete");
  if (!button)
    return;
  const name = button.closest(".classes-row").dataset.className;
  setEditorActionPromise(removeClass(name).finally(renderClassesDialog));
}
classesMenuBtn.addEventListener("click", openClassesDialog);
classesCloseBtn.addEventListener("click", closeClassesDialog);
classesNewBtn.addEventListener("click", openNewClassEditor);
classesList.addEventListener("change", updateClassFromRow);
classesList.addEventListener("click", removeClassFromRow);

// editor-events.ts
function setCodeBoxScrollToLine(lineNum) {
  const { tops } = measureSourceLines();
  codeBox.scrollTop = tops[lineNum] - parseFloat(getComputedStyle(codeBox).paddingTop);
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
  if (refuseMoveWhileNodeNameIsInvalid())
    return;
  const nodeEl = event.target.closest("g.node");
  const id = nodeEl ? getNodeId(nodeEl) : null;
  if (event.shiftKey) {
    if (id) {
      connectNodesWithShiftClick(id);
      return;
    }
  }
  if (event.metaKey) {
    if (id) {
      toggleNodeInSelection(id);
      return;
    }
  }
  if (id)
    selectNodeSourceLine(id);
  selectEditorNode(id);
  saveEditorViewState();
  if (id) {
    selectPhonePathToNode(id, parseEdges(codeBox.value), getEditorGraph());
    render();
  }
};
outputBox.addEventListener("click", selectClickedNode);
outputBox.addEventListener("mousedown", (event) => {
  if (event.shiftKey)
    event.preventDefault();
});
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
var scrollMainViewToPhoneRow = (event) => {
  const row = event.target.closest(".phone-block, .phone-question");
  if (!row)
    return;
  if (refuseMoveWhileNodeNameIsInvalid())
    return;
  selectNodeSourceLine(row.dataset.nodeId);
  selectEditorNode(row.dataset.nodeId);
  saveEditorViewState();
  const node = diagramBox.querySelector('[id*="flowchart-' + row.dataset.nodeId + '-"]');
  const outputRect = outputBox.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  outputBox.scrollBy({
    left: nodeRect.left + nodeRect.width / 2 - outputRect.left - outputBox.clientWidth / 2,
    top: nodeRect.top + nodeRect.height / 2 - outputRect.top - outputBox.clientHeight / 2,
    behavior: "smooth"
  });
};
phoneDiagramBox.addEventListener("click", scrollMainViewToPhoneRow);

// main-events.ts
var DEFAULT_CLASS_LINES = [
  "  classDef information fill:#ffffff,stroke:#000000",
  "  classDef Decision fill:#ffff00,stroke:#000000",
  "  classDef Yes-path fill:#00ff00,stroke:#000000",
  "  classDef No-path fill:#ff0000,stroke:#000000",
  "  classDef Checkpoint fill:#ff8000,stroke:#000000",
  "  classDef Action fill:#fc00ff,stroke:#000000",
  "  classDef Question fill:#79d4fb,stroke:#000000",
  "  classDef Answer fill:#5df9b5,stroke:#000000"
];
async function resetEditorToNewDiagram() {
  if (state.watcher) {
    state.watcher.close();
    state.watcher = null;
  }
  state.currentName = null;
  state.openedFileHandle = null;
  state.loadedPath = null;
  sessionStorage.removeItem("tabOpenedFile");
  statusBox.textContent = "";
  state.phoneFocusNodeId = null;
  state.phoneFocusUsesDecisionContext = false;
  state.phonePreviewChoiceId = null;
  state.diagramScale = null;
  state.currentDecisionId = null;
  applyTypeMetadata(null);
  codeBox.value = ["flowchart TD", "  B_NEW[New idea]", ...DEFAULT_CLASS_LINES].join(`
`);
  resetEditorHistory(codeBox.value);
  await render();
  applyMainViewport(null, getEditorGraph());
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
  state.phoneStartNodeId = null;
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

// node-resize.ts
var GRAB_MARGIN_PX = 6;
var HEXAGON_POINT_COUNT = 6;
var isResizing = false;
var shouldSkipNextClick = false;
function isBlockOrChoiceId(id) {
  const isBlock = id.startsWith("B_");
  const isChoice = id.startsWith("Q_CHOICE_");
  return isBlock || isChoice;
}
function isDecisionId(id) {
  const isQuestion = id.startsWith("Q_");
  const isChoice = id.startsWith("Q_CHOICE_");
  return isQuestion && !isChoice;
}
function findRectangleGrabAt(x, y, nodeEl, id) {
  const shape = nodeEl.querySelector("rect");
  if (!shape)
    return null;
  const box = shape.getBoundingClientRect();
  if (x < box.left - GRAB_MARGIN_PX)
    return null;
  if (x > box.right + GRAB_MARGIN_PX)
    return null;
  if (y < box.top - GRAB_MARGIN_PX)
    return null;
  if (y > box.bottom + GRAB_MARGIN_PX)
    return null;
  const left = Math.abs(x - box.left) <= GRAB_MARGIN_PX;
  const right = Math.abs(x - box.right) <= GRAB_MARGIN_PX;
  const top = Math.abs(y - box.top) <= GRAB_MARGIN_PX;
  const bottom = Math.abs(y - box.bottom) <= GRAB_MARGIN_PX;
  const isNearOutline = left || right || top || bottom;
  if (!isNearOutline)
    return null;
  return { nodeEl, shape, id, isHexagon: false, left, right, top, bottom };
}
function findHexagonGrabAt(x, y, nodeEl, id) {
  const shape = nodeEl.querySelector("polygon");
  if (!shape)
    return null;
  if (shape.points.numberOfItems !== HEXAGON_POINT_COUNT)
    return null;
  const matrix = shape.getScreenCTM();
  const points = [...shape.points].map((point) => new DOMPoint(point.x, point.y).matrixTransform(matrix));
  const boxLeft = Math.min(...points.map((point) => point.x));
  const boxRight = Math.max(...points.map((point) => point.x));
  const boxTop = Math.min(...points.map((point) => point.y));
  const boxBottom = Math.max(...points.map((point) => point.y));
  const middleY = (boxTop + boxBottom) / 2;
  const topEdgeXs = points.filter((point) => Math.abs(point.y - boxTop) < 1).map((point) => point.x);
  const isOverFlatEdge = x >= Math.min(...topEdgeXs) && x <= Math.max(...topEdgeXs);
  const isNearMiddleHeight = Math.abs(y - middleY) <= 2 * GRAB_MARGIN_PX;
  const grab = { nodeEl, shape, id, isHexagon: true, left: false, right: false, top: false, bottom: false };
  if (isOverFlatEdge) {
    if (Math.abs(y - boxTop) <= GRAB_MARGIN_PX)
      return { ...grab, top: true };
    if (Math.abs(y - boxBottom) <= GRAB_MARGIN_PX)
      return { ...grab, bottom: true };
  }
  if (isNearMiddleHeight) {
    if (Math.abs(x - boxLeft) <= GRAB_MARGIN_PX)
      return { ...grab, left: true };
    if (Math.abs(x - boxRight) <= GRAB_MARGIN_PX)
      return { ...grab, right: true };
  }
  return null;
}
function findGrabAt(x, y) {
  for (const nodeEl of diagramBox.querySelectorAll("g.node")) {
    const id = getNodeId(nodeEl);
    let grab = null;
    if (isBlockOrChoiceId(id))
      grab = findRectangleGrabAt(x, y, nodeEl, id);
    if (isDecisionId(id))
      grab = findHexagonGrabAt(x, y, nodeEl, id);
    if (grab)
      return grab;
  }
  return null;
}
function getResizeCursor(grab) {
  const isOnVerticalSide = grab.left || grab.right;
  const isOnHorizontalSide = grab.top || grab.bottom;
  if (!isOnHorizontalSide)
    return "ew-resize";
  if (!isOnVerticalSide)
    return "ns-resize";
  const isOnFallingDiagonal = grab.left && grab.top || grab.right && grab.bottom;
  return isOnFallingDiagonal ? "nwse-resize" : "nesw-resize";
}
function measureMinimumTextArea(nodeEl, pixelsPerUnit) {
  const label = nodeEl.querySelector(".nodeLabel");
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;width:25ch;height:2lh";
  label.appendChild(probe);
  const probeBox = probe.getBoundingClientRect();
  probe.remove();
  return { width: probeBox.width / pixelsPerUnit, height: probeBox.height / pixelsPerUnit };
}
function followResizeDrag(startEvent, grab) {
  const startBox = grab.shape.getBoundingClientRect();
  const startSize = grab.shape.getBBox();
  const pixelsPerUnit = startBox.width / startSize.width;
  const minimumText = measureMinimumTextArea(grab.nodeEl, pixelsPerUnit);
  const minimumHeight = minimumText.height + (grab.isHexagon ? HEXAGON_PADDING_HEIGHT : NODE_PADDING_HEIGHT);
  function getMinimumWidth(height) {
    if (grab.isHexagon)
      return minimumText.width + NODE_PADDING_WIDTH + HEXAGON_POINTS_WIDTH_RATIO * height;
    return minimumText.width + NODE_PADDING_WIDTH;
  }
  let newHeight = Math.max(minimumHeight, startSize.height);
  let newWidth = Math.max(getMinimumWidth(newHeight), startSize.width);
  let hasMoved = false;
  const outline = document.createElement("div");
  outline.id = "nodeResizeOutline";
  outline.style.cssText = "position:fixed;box-sizing:border-box;border:2px dashed #1a73e8;pointer-events:none;z-index:1000";
  document.body.appendChild(outline);
  const previousUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";
  isResizing = true;
  function drawOutline() {
    const widthPx = newWidth * pixelsPerUnit;
    const heightPx = newHeight * pixelsPerUnit;
    outline.style.width = widthPx + "px";
    outline.style.height = heightPx + "px";
    outline.style.left = (grab.left ? startBox.right - widthPx : startBox.left) + "px";
    outline.style.top = (grab.top ? startBox.bottom - heightPx : startBox.top) + "px";
  }
  function moveResize(event) {
    const movedX = (event.clientX - startEvent.clientX) / pixelsPerUnit;
    const movedY = (event.clientY - startEvent.clientY) / pixelsPerUnit;
    hasMoved = true;
    if (grab.bottom)
      newHeight = Math.max(minimumHeight, startSize.height + movedY);
    if (grab.top)
      newHeight = Math.max(minimumHeight, startSize.height - movedY);
    if (grab.right)
      newWidth = Math.max(getMinimumWidth(newHeight), startSize.width + movedX);
    if (grab.left)
      newWidth = Math.max(getMinimumWidth(newHeight), startSize.width - movedX);
    drawOutline();
  }
  function endResize() {
    document.removeEventListener("mousemove", moveResize);
    outline.remove();
    document.body.style.userSelect = previousUserSelect;
    isResizing = false;
    if (!hasMoved)
      return;
    shouldSkipNextClick = true;
    setNodeSize(grab.id, Math.round(newWidth), Math.round(newHeight));
  }
  drawOutline();
  document.addEventListener("mousemove", moveResize);
  document.addEventListener("mouseup", endResize, { once: true });
}
function showResizeCursor(event) {
  if (isResizing)
    return;
  const grab = findGrabAt(event.clientX, event.clientY);
  outputBox.style.cursor = grab ? getResizeCursor(grab) : "";
}
function startResizeOnMouseDown(event) {
  shouldSkipNextClick = false;
  if (event.button !== 0)
    return;
  if (event.shiftKey)
    return;
  if (event.metaKey)
    return;
  if (event.ctrlKey)
    return;
  const grab = findGrabAt(event.clientX, event.clientY);
  if (!grab)
    return;
  followResizeDrag(event, grab);
}
function skipClickAfterResize(event) {
  if (!shouldSkipNextClick)
    return;
  shouldSkipNextClick = false;
  event.stopPropagation();
}
outputBox.addEventListener("mousemove", showResizeCursor);
outputBox.addEventListener("mousedown", startResizeOnMouseDown);
outputBox.addEventListener("click", skipClickAfterResize, true);

// editor-add-standalone.ts
async function addStandaloneStaticBlock() {
  const graph = getEditorGraph();
  const staticId = getNextEditorId("B_NEW", graph);
  const newLines = [`  ${staticId}["New static block"]`];
  await applyEditorSource(buildSourceWithLinesReplaced(graph, new Set, newLines));
  selectEditorNode(staticId);
  setInspectorTextFocus();
}
async function addStandaloneDecisionBlock() {
  const graph = getEditorGraph();
  const decisionId = getNextEditorId("Q_NEW", graph);
  const yesId = buildChoiceId(decisionId, "Y");
  const noId = buildChoiceId(decisionId, "N");
  const newLines = [
    `  ${decisionId}{{"New Decision"}}`,
    `  ${yesId}["Yes"]`,
    `  ${noId}["No"]`,
    `  ${decisionId} --> ${yesId}`,
    `  ${decisionId} --> ${noId}`
  ];
  await applyEditorSource(buildSourceWithLinesReplaced(graph, new Set, newLines));
  selectEditorNode(decisionId);
  setInspectorTextFocus();
}

// viewport-menu.ts
function openViewportMenu(event) {
  event.preventDefault();
  viewportMenu.style.left = event.clientX + "px";
  viewportMenu.style.top = event.clientY + "px";
  viewportMenu.hidden = false;
}
function closeViewportMenu() {
  viewportMenu.hidden = true;
}
function closeViewportMenuOnEscape(event) {
  if (event.key === "Escape")
    closeViewportMenu();
}
function addDecisionBlockFromMenu() {
  appendEditorAction(addStandaloneDecisionBlock);
}
function addStaticBlockFromMenu() {
  appendEditorAction(addStandaloneStaticBlock);
}
outputBox.addEventListener("contextmenu", openViewportMenu);
addDecisionBlockMenuBtn.addEventListener("click", addDecisionBlockFromMenu);
addStaticBlockMenuBtn.addEventListener("click", addStaticBlockFromMenu);
document.addEventListener("click", closeViewportMenu);
document.addEventListener("keydown", closeViewportMenuOnEscape);

// viewer.ts
applyMainZoom(false);
async function loadLastOpened() {
  const tabOpenedFile = JSON.parse(sessionStorage.getItem("tabOpenedFile") ?? "null");
  if (tabOpenedFile?.name)
    return loadDiagram(tabOpenedFile.name);
  if (tabOpenedFile?.path) {
    const tabFileResponse = await fetch("/api/opened-file?path=" + encodeURIComponent(tabOpenedFile.path));
    if (tabFileResponse.ok)
      return showOpenedFile(tabOpenedFile.path, await tabFileResponse.text());
  }
  const response = await fetch("/api/last-opened");
  if (response.status === 204)
    return loadDiagram("accountability.mmd");
  const saved = await response.json();
  if (saved.name)
    return loadDiagram(saved.name);
  showOpenedFile(saved.path, saved.text);
}
loadLastOpened();
Object.assign(window, { render, loadDiagram, showOpenedFile, codeBox, getNodeId, selectEditorNode, addQuestionAfter, addBlockAfter, removeQuestion, removeBlock, addChoice, removeChoice, removeChoices, applyEditorUndo, applyEditorRedo, insertStaticBefore, insertDecisionBefore, listAllPathIds, setNodeSize });
