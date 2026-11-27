import { diagramBox, fullDiagramBtn, functionsOnlyToggle, nextViewPathBtn, onePathViewBtn, outputBox, pathViewControls, previousViewPathBtn, viewPathLabel, codeBox } from './dom.ts';
import type { Edge } from './dom.ts';
import { moveNodeToViewportCenter } from './decision-nav.ts';
import { filterToFunctions } from './function-routing.ts';
import { getEditorGraph } from './editor-graph.ts';
import { showInspectorNotice } from './editor-rename.ts';
import { renderNodeInspector } from './node-inspector.ts';
// import { buildPathEdges, findPathByNumber } from './path-view-model.ts';
// import { buildPathEdges, findPathByNumber, findViewEditRefusal } from './path-view-model.ts';
// import type { ViewEdit } from './path-view-model.ts';
import { findNeighbourDigits, findViewEditRefusal, listDigitMaximums, walkDigitPath } from './path-view-model.ts';
import type { PathDiagram, PathView, ViewEdit } from './path-view-model.ts';
import { findRoots } from './phone-render.ts';
import { render } from './render.ts';
import { state } from './state.ts';
// import { buildSubsetSource } from './subset-source.ts';
import { buildPathSource } from './subset-source.ts';
import { selectEditorNode } from './editor-actions.ts';
import type { EditorGraph } from './editor-types.ts';

// function renderPathViewControls(hasNextPath: boolean) {
//     const view = state.pathView;
//     pathViewControls.hidden = !view;
//     onePathViewBtn.setAttribute('aria-pressed', String(!!view));
//     onePathViewBtn.disabled = state.functionsOnly;
//     functionsOnlyToggle.disabled = !!view;
//     if (!view)
//         return;
//     viewPathLabel.textContent = `Path ${view.pathNumber}`;
//     previousViewPathBtn.disabled = view.pathNumber === 1;
//     nextViewPathBtn.disabled = !hasNextPath;
// }
//
// // The diagram text the main view draws: the whole file, or the blocks and arrows of the shown path.
// export function buildMainViewSource(graph: EditorGraph): string {
//     const view = state.pathView;
//     if (!view) {
//         renderPathViewControls(false);
//         if (state.functionsOnly)
//             return filterToFunctions(codeBox.value);
//         return codeBox.value;
//     }
//     const edges: Edge[] = graph.edges.map((edge) => [edge.from, edge.to]);
//     const path = findPathByNumber(findRoots(edges), edges, view.pathNumber!);
//     view.pathNumber = path.pathNumber;
//     view.pathIds = path.pathIds;
//     view.shownNodeIds = [...new Set(path.pathIds)];
//     view.protectedIds = path.pathIds;
//     renderPathViewControls(path.hasNextPath);
//     return buildSubsetSource(graph, view.shownNodeIds, buildPathEdges(path.pathIds));
// }

function buildPathDiagram(graph: EditorGraph): PathDiagram {
    const edges: Edge[] = graph.edges.map((edge) => [edge.from, edge.to]);
    const decisionIds = [...graph.nodes.values()].filter((node) => node.kind === 'question').map((node) => node.id);
    return { startIds: findRoots(edges), edges, decisionIds };
}

// The view's number in this diagram. A digit that names no choice any more becomes 0.
function listViewDigits(view: PathView, diagram: PathDiagram): number[] {
    const maximums = listDigitMaximums(diagram);
    const storedDigits = [view.startDigit, ...diagram.decisionIds.map((id) => view.decisionDigits[id] ?? 0)];
    return storedDigits.map((digit, i) => digit > maximums[i] ? 0 : digit);
}

// Digits are stored by decision id, so an edit keeps the digit of each decision that stays.
function storeViewDigits(view: PathView, diagram: PathDiagram, digits: number[]) {
    view.startDigit = digits[0];
    for (const [index, id] of diagram.decisionIds.entries())
        view.decisionDigits[id] = digits[index + 1];
}

function renderPathViewControls() {
    const view = state.pathView;
    pathViewControls.hidden = !view;
    onePathViewBtn.setAttribute('aria-pressed', String(!!view));
    onePathViewBtn.disabled = state.functionsOnly;
    functionsOnlyToggle.disabled = !!view;
}

function renderPathNumber(diagram: PathDiagram, digits: number[]) {
    viewPathLabel.textContent = `Path 0x${digits.map((digit) => digit.toString(16).toUpperCase()).join('')}`;
    previousViewPathBtn.disabled = !findNeighbourDigits(diagram, digits, -1);
    nextViewPathBtn.disabled = !findNeighbourDigits(diagram, digits, 1);
}

// The diagram text the main view draws: the whole file, or the blocks and arrows of the shown path.
export function buildMainViewSource(graph: EditorGraph): string {
    renderPathViewControls();
    const view = state.pathView;
    if (!view) {
        if (state.functionsOnly)
            return filterToFunctions(codeBox.value);
        return codeBox.value;
    }
    const diagram = buildPathDiagram(graph);
    const path = walkDigitPath(diagram, listViewDigits(view, diagram));
    storeViewDigits(view, diagram, path.digits);
    view.pathIds = path.pathIds;
    view.shownNodeIds = [...new Set(path.pathIds)];
    view.protectedIds = path.pathIds;
    renderPathNumber(diagram, path.digits);
    return buildPathSource(graph, path.pathIds);
}

// The inspector buttons that a view can refuse; a button that is not listed is always allowed.
const VIEW_EDIT_BY_ACTION: Record<string, ViewEdit> = {
    'remove': 'removeNode',
    'remove-choices': 'removeChoices',
    'add-choice': 'addChoice',
    'add-static-after': 'addStaticAfter',
    'insert-static-after': 'insertStaticAfter',
};

export function disableRefusedButtons(buttons: HTMLButtonElement[], graph: EditorGraph, nodeId: string) {
    for (const button of buttons) {
        const edit = VIEW_EDIT_BY_ACTION[button.dataset.action!];
        if (!edit)
            continue;
        const refusal = findViewEditRefusal(state.pathView, graph, edit, nodeId);
        if (!refusal)
            continue;
        button.disabled = true;
        button.title = refusal;
    }
}

// True when the view on screen refuses the edit; the pop-up says why.
export function refuseEditInPathView(edit: ViewEdit, nodeId: string | null) {
    if (!state.pathView)
        return false;
    const refusal = findViewEditRefusal(state.pathView, getEditorGraph(), edit, nodeId);
    if (!refusal)
        return false;
    showInspectorNotice(refusal);
    return true;
}

async function closePathView() {
    state.pathView = null;
    codeBox.readOnly = false;
    await render();
    renderNodeInspector();
    if (state.selectedEditorNodeId)
        moveNodeToViewportCenter(outputBox, diagramBox, state.selectedEditorNodeId);
}

async function toggleOnePathView() {
    if (state.pathView) {
        await closePathView();
        return;
    }
    // state.pathView = { kind: 'onePath', anchorId: null, pathNumber: 1, pathIds: null, shownNodeIds: [], protectedIds: [] };
    state.pathView = { kind: 'onePath', anchorId: null, startDigit: 0, decisionDigits: {}, pathIds: null, shownNodeIds: [], protectedIds: [] };
    codeBox.readOnly = true;
    await render();
    renderNodeInspector();
    const selectedId = state.selectedEditorNodeId;
    const isSelectedShown = state.pathView.shownNodeIds.includes(selectedId!);
    const centeredId = isSelectedShown ? selectedId! : state.pathView.pathIds![0];
    moveNodeToViewportCenter(outputBox, diagramBox, centeredId);
}

// async function moveToViewPath(step: 1 | -1) {
//     state.pathView!.pathNumber! += step;
//     await render();
//     renderNodeInspector();
//     moveNodeToViewportCenter(outputBox, diagramBox, state.pathView!.pathIds![0]);
// }

// The button is disabled when no path lies in that direction.
async function moveToViewPath(step: 1 | -1) {
    const view = state.pathView!;
    const diagram = buildPathDiagram(getEditorGraph());
    storeViewDigits(view, diagram, findNeighbourDigits(diagram, listViewDigits(view, diagram), step)!);
    await render();
    const selectedId = state.selectedEditorNodeId;
    const isSelectionHidden = !!selectedId && !view.shownNodeIds.includes(selectedId);
    // A selected block that the new path does not draw loses the selection.
    if (isSelectionHidden)
        selectEditorNode(null);
    else
        renderNodeInspector();
    moveNodeToViewportCenter(outputBox, diagramBox, view.pathIds![0]);
}

function showPreviousViewPath() {
    moveToViewPath(-1);
}

function showNextViewPath() {
    moveToViewPath(1);
}

onePathViewBtn.addEventListener('click', toggleOnePathView);
fullDiagramBtn.addEventListener('click', closePathView);
previousViewPathBtn.addEventListener('click', showPreviousViewPath);
nextViewPathBtn.addEventListener('click', showNextViewPath);
