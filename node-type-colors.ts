import type { EditorGraph } from './editor-types.ts';
import { codeBox, diagramBox } from './dom.ts';
import { getNodeId } from './render-helpers.ts';
import { buildClassStyleIndex, findNodeStyle } from './class-style-index.ts';

// Retired: colors used to come from state.typeColors/state.nodeTypes metadata (a second system
// that fought mermaid's own `classDef`/`class` lines). Color now comes only from those lines.
// import { nodeTypeColorInput, nodeTypeInput, phoneDiagramBox } from './dom.ts';
// import { editorGraph, setEditorActionPromise, sourceWithEditorMetadata } from './editor-graph.ts';
// import { saveDiagram } from './diagram-io.ts';
// import { state } from './state.ts';
// import type { EditorNode } from './editor-types.ts';

export function getEditorNodeKind(id: string, graph: EditorGraph) {
  return graph.nodes.get(id)?.kind;
}

// export function effectiveNodeType(node: EditorNode) {
//   if (node.kind === 'question')
//     return 'decision';
//   if (node.kind === 'choice')
//     return 'choice';
//   return state.nodeTypes[node.id]?.trim() || 'static';
// }

// export function colorForNode(node: EditorNode) {
//   return state.typeColors[effectiveNodeType(node)] ?? state.typeColors.static;
// }

const UNCLASSED_STRIPE_PATTERN_ID = 'unclassed-stripe-pattern';

function addUnclassedStripePattern(svg: SVGSVGElement) {
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  const existingPattern = defs.querySelector('#' + UNCLASSED_STRIPE_PATTERN_ID);
  if (existingPattern)
    return;
  defs.insertAdjacentHTML('beforeend', `<pattern id="${UNCLASSED_STRIPE_PATTERN_ID}" width="16" height="16" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#fde8e8"/><rect width="8" height="16" fill="#f4b4b4"/></pattern>`);
}

// Unclassed nodes get pale red stripes in the main view instead of a flat fill.
export function applyNodeTypeColors(graph: EditorGraph) {
  const svg = diagramBox.querySelector('svg');
  if (!svg)
    return;
  const classIndex = buildClassStyleIndex(codeBox.value);
  for (const nodeEl of diagramBox.querySelectorAll('g.node')) {
    const node = graph.nodes.get(getNodeId(nodeEl));
    if (!node)
      continue; // Slice stubs and stale metadata entries are intentionally ignored.
    const isClassed = !!findNodeStyle(classIndex, node.id);
    if (isClassed)
      continue;
    addUnclassedStripePattern(svg);
    for (const shape of nodeEl.querySelectorAll('rect, path, polygon'))
      (shape as SVGElement).style.fill = `url(#${UNCLASSED_STRIPE_PATTERN_ID})`;
    // const label = nodeEl.querySelector<HTMLElement>('.nodeLabel');
    // if (label)
    //   label.style.opacity = '0.15';
  }
}

export function applyNoteDots(graph: EditorGraph) {
  for (const nodeEl of diagramBox.querySelectorAll('g.node')) {
    if (!graph.nodes.get(getNodeId(nodeEl))?.note)
      continue;
    const box = (nodeEl as SVGGraphicsElement).getBBox();
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('class', 'note-dot');
    dot.setAttribute('cx', String(box.x + 6));
    dot.setAttribute('cy', String(box.y + 6));
    dot.setAttribute('r', '4');
    const fill = getComputedStyle(nodeEl.querySelector('rect, path, polygon')!).fill;
    const rgb = fill.match(/rgb\((\d+), (\d+), (\d+)/);
    if (!rgb)
      dot.style.fill = 'rgb(11, 75, 75)';
    else {
      const [r, g, b] = rgb.slice(1).map(Number);
      const isMidGray = [r, g, b].every((channel) => channel >= 96 && channel <= 159);
      const midGrayFill = (r + g + b) / 3 >= 128 ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
      dot.style.fill = isMidGray ? midGrayFill : `rgb(${255 - r}, ${255 - g}, ${255 - b})`;
    }
    nodeEl.appendChild(dot);
  }
}

// export async function saveTypeMetadata() {
//   codeBox.value = sourceWithEditorMetadata(codeBox.value);
//   await saveDiagram();
// }

// export function commitNodeType() {
//   const id = state.selectedEditorNodeId;
//   if (!id)
//     return;
//   let graph: EditorGraph;
//   try {
//     graph = editorGraph();
//   }
//   catch {
//     return;
//   }
//   const node = graph.nodes.get(id);
//   if (!node || node.kind !== 'block')
//     return;
//   const type = nodeTypeInput.value.trim() || 'static';
//   if (type === 'static')
//     delete state.nodeTypes[id];
//   else
//     state.nodeTypes[id] = type;
//   nodeTypeInput.value = type;
//   applyNodeTypeColors(graph);
//   setEditorActionPromise(saveTypeMetadata());
// }

// export function commitTypeColor() {
//   const id = state.selectedEditorNodeId;
//   if (!id)
//     return;
//   let graph: EditorGraph;
//   try {
//     graph = editorGraph();
//   }
//   catch {
//     return;
//   }
//   const node = graph.nodes.get(id);
//   if (!node)
//     return;
//   state.typeColors[effectiveNodeType(node)] = nodeTypeColorInput.value;
//   applyNodeTypeColors(graph);
//   setEditorActionPromise(saveTypeMetadata());
// }

