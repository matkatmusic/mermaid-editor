declare const mermaid: any;
import { codeBox, darkModeToggle, decisionCounter, diagramBox, errorBox, errorLog, functionsOnlyToggle, mermaidOptions, outputBox } from './dom.ts';
import { editorGraph } from './editor-graph.ts';
import { discardInvalidPhonePreview, updateDecisionCounter } from './decision-nav.ts';
import { parseEdges } from './diagram-source.ts';
import { filterToFunctions } from './function-routing.ts';
import { sliceIds } from './graph-slice.ts';
import { phonePath, state } from './state.ts';
import { applyNodeTypeColors } from './node-type-colors.ts';
import { renderEditorSelection } from './editor-actions.ts';
import { highlightPath, showEditorValidationError } from './render-helpers.ts';
import { baseScale, viewBoxOf } from './zoom.ts';
import { renderPhone } from './phone-render.ts';
import { positionNodeInspector } from './node-inspector.ts';

export async function render() {
  errorBox.textContent = '';
  try {
    // Validate first; invalid diagrams only show their editor error, not editing or rendering.
    const graph = editorGraph();
    discardInvalidPhonePreview(graph);
    updateDecisionCounter(graph);
    const edges = parseEdges(codeBox.value);
    // drop a phonePath that no longer matches the diagram, like resetBtn does
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
    // state.currentBottomQ is kept for the main-view decision-focus/preview integration (decision-nav.ts, editor-events.ts); the phone pane itself no longer needs it.
    const ids = edges.length > 0 ? sliceIds(edges) : [];
    const reversedIds = [...ids].reverse();
    let bottomQ = state.phoneFocusNodeId && graph.nodes.get(state.phoneFocusNodeId)?.kind === 'question'
      ? state.phoneFocusNodeId
      : undefined;
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
    const { svg: regularSvg } = await mermaid.render('diagram-' + (state.renderId++), mainSource);
    // A newer render() started while this one was awaiting Mermaid; drop this stale result.
    if (state.renderId !== myRenderId + 1)
      return;
    // Resolve scale before the DOM write; awaiting after innerHTML flashes one frame of unsized, overlapping nodes.
    const hasEdges = edges.length > 0;
    const scaleIsUnset = state.diagramScale === null;
    if (hasEdges) {
      if (scaleIsUnset)
        state.diagramScale = await baseScale(edges);
    }
    diagramBox.innerHTML = regularSvg;
    renderPhone(phoneEdges, graph);
    applyNodeTypeColors(graph);
    renderEditorSelection();
    highlightPath();
    if (edges.length > 0) {
      const scale = state.diagramScale!;
      const mainZoom = state.mainZoomPercent / 100;
      const regularSvgEl = diagramBox.querySelector('svg')!;
      const regularBox = viewBoxOf(regularSvg);
      regularSvgEl.style.width = regularBox.width * scale * mainZoom + 'px';
      regularSvgEl.style.height = regularBox.height * scale * mainZoom + 'px';
    }
    outputBox.scrollLeft = regularViewport.left;
    outputBox.scrollTop = regularViewport.top;
    positionNodeInspector();
    errorLog.textContent = '';
    errorLog.classList.remove('open');
  }
  catch (err) {
    state.currentDecisionId = null;
    decisionCounter.textContent = '0 / 0';
    showEditorValidationError(err);
  }
}

functionsOnlyToggle.addEventListener('change', () => {
  state.functionsOnly = functionsOnlyToggle.checked;
  render();
});

darkModeToggle.addEventListener('change', () => {
  document.body.classList.toggle('dark', darkModeToggle.checked);
  mermaid.initialize(mermaidOptions());
  render();
});
