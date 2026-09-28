import type { EditorGraph } from './editor-types.ts';
import { codeBox, diagramBox } from './dom.ts';
import { nodeIdOf } from './render-helpers.ts';
import { buildClassStyleIndex, styleOfNode } from './class-defs.ts';

// Retired: colors used to come from state.typeColors/state.nodeTypes metadata (a second system
// that fought mermaid's own `classDef`/`class` lines). Color now comes only from those lines.
// import { nodeTypeColorInput, nodeTypeInput, phoneDiagramBox } from './dom.ts';
// import { editorGraph, setEditorActionPromise, sourceWithEditorMetadata } from './editor-graph.ts';
// import { saveDiagram } from './diagram-io.ts';
// import { state } from './state.ts';
// import type { EditorNode } from './editor-types.ts';

export function editorNodeKind(id: string, graph: EditorGraph) {
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

function ensureUnclassedStripePattern(svg: SVGSVGElement) {
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  if (defs.querySelector('#' + UNCLASSED_STRIPE_PATTERN_ID))
    return;
  defs.insertAdjacentHTML('beforeend', `<pattern id="${UNCLASSED_STRIPE_PATTERN_ID}" width="16" height="16" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="black"/><rect width="8" height="16" fill="red"/></pattern>`);
}

// Unclassed nodes get red/black stripes in the main view instead of a flat fill.
export function applyNodeTypeColors(graph: EditorGraph) {
  const svg = diagramBox.querySelector('svg');
  if (!svg)
    return;
  const classIndex = buildClassStyleIndex(codeBox.value);
  for (const nodeEl of diagramBox.querySelectorAll('g.node')) {
    const node = graph.nodes.get(nodeIdOf(nodeEl));
    if (!node)
      continue; // Slice stubs and stale metadata entries are intentionally ignored.
    const isClassed = !!styleOfNode(classIndex, node.id);
    if (isClassed)
      continue;
    ensureUnclassedStripePattern(svg);
    for (const shape of nodeEl.querySelectorAll('rect, path, polygon'))
      (shape as SVGElement).style.fill = `url(#${UNCLASSED_STRIPE_PATTERN_ID})`;
    const label = nodeEl.querySelector<HTMLElement>('.nodeLabel');
    if (label)
      label.style.opacity = '0.15';
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

