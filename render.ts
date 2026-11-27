// declare const mermaid: any;
declare const mermaid: import('mermaid').Mermaid;
import { codeBox, darkModeToggle, decisionCounter, diagramBox, errorBox, errorLog, functionsOnlyToggle, getMermaidOptions, outputBox } from './dom.ts';
import { getEditorGraph } from './source/model/editor-graph.ts';
import { clearInvalidPhonePreview, updateDecisionCounter } from './decision-nav.ts';
import { parseEdges } from './source/model/diagram-source.ts';
import { filterToFunctions } from './source/model/function-routing.ts';
import { moveClassLinesToEnd } from './source/model/class-lines.ts';
import { sliceIds } from './source/model/graph-slice.ts';
import { phonePath, state } from './state.ts';
import { applyNodeTypeColors, applyNoteDots } from './node-type-colors.ts';
import { renderEditorSelection } from './source/actions/edit/editor-actions.ts';
import { applyPathHighlight, reportEditorValidationError } from './render-helpers.ts';
import { /* baseScale, */ viewBoxOf } from './zoom.ts';
import { renderPhone } from './phone-html.ts';
import { updateNodeInspectorPosition } from './node-inspector-focus.ts';
import { renderSourceLines } from './source-lines.ts';
import { buildSourceWithCodeTags } from './source/model/label-code.ts';
import { buildSourceWithSizeWrappers } from './source/model/node-size.ts';
import { updateOffscreenArrowHeads } from './offscreen-arrow-heads.ts';
import { buildMainViewSource } from './path-view.ts';

let outputPointerHeld: Promise<void> | null = null;
function holdNewDrawingUntilPointerIsUp() {
  outputPointerHeld = new Promise<void>((resolve) => {
    function endHold() {
      outputPointerHeld = null;
      resolve();
    }
    // pointerup, mouseup, click and dblclick run in one task; the timeout lets them reach the old nodes first.
    function endHoldAfterClick() {
      setTimeout(endHold, 0);
    }
    document.addEventListener('pointerup', endHoldAfterClick, { once: true, capture: true });
    document.addEventListener('pointercancel', endHoldAfterClick, { once: true, capture: true });
  });
}
outputBox.addEventListener('pointerdown', holdNewDrawingUntilPointerIsUp, true);

export async function render() {
  renderSourceLines();
  errorBox.textContent = '';
  try {
    // Validate first; invalid diagrams only show their editor error, not editing or rendering.
    const graph = getEditorGraph();
    clearInvalidPhonePreview(graph);
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
    // A view sets the phone path here, so this runs before sliceIds reads it.
    const viewSource = buildMainViewSource(graph);
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
    // const mainSource = buildSourceWithSizeWrappers(buildSourceWithCodeTags(moveClassLinesToEnd(state.functionsOnly ? filterToFunctions(codeBox.value) : codeBox.value)));
    // const mainSource = buildSourceWithSizeWrappers(buildSourceWithCodeTags(moveClassLinesToEnd(buildMainViewSource(graph))));
    const mainSource = buildSourceWithSizeWrappers(buildSourceWithCodeTags(moveClassLinesToEnd(viewSource)));
    const phoneEdges = state.functionsOnly ? parseEdges(filterToFunctions(codeBox.value)) : edges;
    const regularViewport = { left: outputBox.scrollLeft, top: outputBox.scrollTop };
    const myRenderId = state.renderId;
    const { svg: regularSvg } = await mermaid.render('diagram-' + (state.renderId++), mainSource);
    // New nodes under a held mouse button swallow the click and the dblclick.
    await outputPointerHeld;
    // A newer render() started while this one was awaiting Mermaid; drop this stale result.
    if (state.renderId !== myRenderId + 1)
      return;
    // Resolve scale before the DOM write; awaiting after innerHTML flashes one frame of unsized, overlapping nodes.
    // A diagram with nodes but no edges (a new document) still needs the scale and the pixel size below: the svg's own width of 100% is 0 inside the padded #diagram.
    const hasNodes = graph.nodes.size > 0;
    const scaleIsUnset = state.diagramScale === null;
    if (hasNodes) {
      // A fixed scale keeps main-view text the same size; baseScale tied it to the window height at load.
      if (scaleIsUnset)
        state.diagramScale = 1;
      // if (scaleIsUnset)
      //   state.diagramScale = await baseScale(edges);
    }
    diagramBox.innerHTML = regularSvg;
    // applyCodeSpans(diagramBox);
    renderPhone(phoneEdges, graph);
    applyNodeTypeColors(graph);
    applyNoteDots(graph);
    renderEditorSelection();
    applyPathHighlight();
    if (hasNodes) {
      const scale = state.diagramScale!;
      const mainZoom = state.mainZoomPercent / 100;
      const regularSvgEl = diagramBox.querySelector('svg')!;
      const regularBox = viewBoxOf(regularSvg);
      regularSvgEl.style.width = regularBox.width * scale * mainZoom + 'px';
      regularSvgEl.style.height = regularBox.height * scale * mainZoom + 'px';
    }
    outputBox.scrollLeft = regularViewport.left;
    outputBox.scrollTop = regularViewport.top;
    updateNodeInspectorPosition();
    updateOffscreenArrowHeads();
    errorLog.textContent = '';
    errorLog.classList.remove('open');
  }
  catch (err) {
    state.currentDecisionId = null;
    decisionCounter.textContent = '0 / 0';
    reportEditorValidationError(err);
  }
}

function applyFunctionsOnlyToggle() {
  state.functionsOnly = functionsOnlyToggle.checked;
  render();
}

function applyDarkModeToggle() {
  document.body.classList.toggle('dark', darkModeToggle.checked);
  mermaid.initialize(getMermaidOptions());
  render();
}

functionsOnlyToggle.addEventListener('change', applyFunctionsOnlyToggle);
darkModeToggle.addEventListener('change', applyDarkModeToggle);
