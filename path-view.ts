// import { diagramBox, fullDiagramBtn, functionsOnlyToggle, nextViewPathBtn, onePathViewBtn, outputBox, pathViewControls, previousViewPathBtn, viewPathLabel, codeBox } from './dom.ts';
// import { diagramBox, fullDiagramBtn, functionsOnlyToggle, nextViewPathBtn, onePathViewBtn, outputBox, pathViewControls, previousViewPathBtn, viewPathLabel, codeBox, downstreamViewBtn, downstreamViewControls, backDownstreamViewBtn, resetDownstreamViewBtn } from './dom.ts';
import { diagramBox, fullDiagramBtn, functionsOnlyToggle, nextViewPathBtn, onePathViewBtn, outputBox, pathViewControls, previousViewPathBtn, viewPathLabel, codeBox, downstreamViewBtn, downstreamViewControls, backDownstreamViewBtn, resetDownstreamViewBtn, copyPathCommandBtn, copyDownstreamCommandBtn } from './dom.ts';
import type { Edge } from './dom.ts';
import { moveNodeToViewportCenter } from './decision-nav.ts';
import { filterToFunctions } from './function-routing.ts';
import { getEditorGraph } from './editor-graph.ts';
import { showInspectorNotice } from './editor-rename.ts';
import { renderNodeInspector } from './node-inspector.ts';
// import { buildPathEdges, findPathByNumber } from './path-view-model.ts';
// import { buildPathEdges, findPathByNumber, findViewEditRefusal } from './path-view-model.ts';
// import type { ViewEdit } from './path-view-model.ts';
// import { findNeighbourDigits, findViewEditRefusal, listDigitMaximums, walkDigitPath } from './path-view-model.ts';
// import { addFilterClick, buildPathEdges, collectDownstreamEdges, findNeighbourDigits, findShortestRouteIds, findViewEditRefusal, isViewLimitingEdits, listDigitMaximums, walkDigitPath } from './path-view-model.ts';
import { addFilterClick, buildPathDiagram, findNeighbourDigits, findRouteDigits, findShortestRouteIds, findViewEditRefusal, formatPathNumber, isViewLimitingEdits, listDigitMaximums, listRouteAndDownstreamEdges, walkDigitPath } from './path-view-model.ts';
import type { PathDiagram, PathView, ViewEdit } from './path-view-model.ts';
// import { findRoots } from './phone-render.ts';
// import { findRoots, findRouteIdsToNode } from './phone-render.ts';
import { findRouteIdsToNode } from './phone-render.ts';
import { render } from './render.ts';
// import { state } from './state.ts';
import { phonePath, state } from './state.ts';
import { choicesOf, parentOf } from './graph-slice.ts';
import { saveEditorViewState } from './editor-view-state.ts';
// import { buildSubsetSource } from './subset-source.ts';
// import { buildPathSource } from './subset-source.ts';
import { buildPathSource, buildSubsetSource } from './subset-source.ts';
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

// function buildPathDiagram(graph: EditorGraph): PathDiagram {
//     const edges: Edge[] = graph.edges.map((edge) => [edge.from, edge.to]);
//     const decisionIds = [...graph.nodes.values()].filter((node) => node.kind === 'question').map((node) => node.id);
//     return { startIds: findRoots(edges), edges, decisionIds };
// }

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

// function renderPathViewControls() {
//     const view = state.pathView;
//     pathViewControls.hidden = !view;
//     onePathViewBtn.setAttribute('aria-pressed', String(!!view));
//     onePathViewBtn.disabled = state.functionsOnly;
//     functionsOnlyToggle.disabled = !!view;
// }

function renderPathViewControls() {
    const view = state.pathView;
    const isOnePath = view?.kind === 'onePath';
    const isDownstream = view?.kind === 'downstream';
    pathViewControls.hidden = !isOnePath;
    onePathViewBtn.setAttribute('aria-pressed', String(isOnePath));
    onePathViewBtn.disabled = state.functionsOnly || isDownstream;
    downstreamViewControls.hidden = !isDownstream;
    downstreamViewBtn.setAttribute('aria-pressed', String(isDownstream));
    downstreamViewBtn.disabled = state.functionsOnly || isOnePath;
    backDownstreamViewBtn.disabled = !view?.clickHistory.length;
    functionsOnlyToggle.disabled = !!view;
    // A copy button needs a file for the command, and the downstream one needs a clicked route.
    const hasFile = !!state.loadedPath;
    copyPathCommandBtn.disabled = !hasFile;
    copyDownstreamCommandBtn.disabled = !hasFile || !view?.clickedIds.length;
}

function renderPathNumber(diagram: PathDiagram, digits: number[]) {
    // viewPathLabel.textContent = `Path 0x${digits.map((digit) => digit.toString(16).toUpperCase()).join('')}`;
    viewPathLabel.textContent = `Path ${formatPathNumber(digits)}`;
    previousViewPathBtn.disabled = !findNeighbourDigits(diagram, digits, -1);
    nextViewPathBtn.disabled = !findNeighbourDigits(diagram, digits, 1);
}

// // The diagram text the main view draws: the whole file, or the blocks and arrows of the shown path.
// export function buildMainViewSource(graph: EditorGraph): string {
//     renderPathViewControls();
//     const view = state.pathView;
//     if (!view) {
//         if (state.functionsOnly)
//             return filterToFunctions(codeBox.value);
//         return codeBox.value;
//     }
//     const diagram = buildPathDiagram(graph);
//     const path = walkDigitPath(diagram, listViewDigits(view, diagram));
//     storeViewDigits(view, diagram, path.digits);
//     view.pathIds = path.pathIds;
//     view.shownNodeIds = [...new Set(path.pathIds)];
//     view.protectedIds = path.pathIds;
//     renderPathNumber(diagram, path.digits);
//     return buildPathSource(graph, path.pathIds);
// }

function buildOnePathSource(view: PathView, graph: EditorGraph): string {
    const diagram = buildPathDiagram(graph);
    const path = walkDigitPath(diagram, listViewDigits(view, diagram));
    storeViewDigits(view, diagram, path.digits);
    view.pathIds = path.pathIds;
    view.shownNodeIds = [...new Set(path.pathIds)];
    view.protectedIds = path.pathIds;
    renderPathNumber(diagram, path.digits);
    return buildPathSource(graph, path.pathIds);
}

// An edit or an undo that takes a clicked block away turns the view off.
function closeViewWithRemovedBlock(graph: EditorGraph) {
    const view = state.pathView;
    if (!view)
        return;
    for (const id of view.clickedIds) {
        if (!graph.nodes.has(id)) {
            state.pathView = null;
            codeBox.readOnly = false;
            return;
        }
    }
}

// The clicked route from a start block, then every block after the latest clicked block.
function buildDownstreamSource(view: PathView, graph: EditorGraph): string {
    view.pathIds = null;
    if (!view.clickedIds.length) {
        view.shownNodeIds = [...graph.nodes.keys()];
        view.protectedIds = [];
        return codeBox.value;
    }
    const edges: Edge[] = graph.edges.map((edge) => [edge.from, edge.to]);
    const routeIds = findRouteIdsToNode(view.clickedIds[0], edges, graph);
    for (let i = 1; i < view.clickedIds.length; i++)
        routeIds.push(...findShortestRouteIds(view.clickedIds[i - 1], view.clickedIds[i], edges).slice(1));
    // const latestId = view.clickedIds[view.clickedIds.length - 1];
    // // A map by arrow keeps each arrow once.
    // const shownEdgesByKey = new Map<string, Edge>();
    // for (const edge of [...buildPathEdges(routeIds), ...collectDownstreamEdges(latestId, edges)])
    //     shownEdgesByKey.set(edge.join(' '), edge);
    // const shownEdges = [...shownEdgesByKey.values()];
    // The same arrows as print-path.ts prints with --includeAfter.
    const shownEdges = listRouteAndDownstreamEdges(routeIds, edges);
    view.shownNodeIds = [...new Set([...routeIds, ...shownEdges.flat()])];
    view.protectedIds = routeIds;
    // The copy command needs a path number, and some routes have none.
    if (findRouteDigits(buildPathDiagram(graph), routeIds) === null)
        copyDownstreamCommandBtn.disabled = true;
    return buildSubsetSource(graph, view.shownNodeIds, shownEdges);
}

// False only for a block that the view on screen leaves out.
export function isNodeDrawn(id: string) {
    if (!state.pathView)
        return true;
    return state.pathView.shownNodeIds.includes(id);
}

// The phone walks the drawn route: one answer for each decision on it.
function showRouteInPhone(view: PathView, graph: EditorGraph) {
    phonePath.length = 0;
    for (let i = 0; i + 1 < view.protectedIds.length; i++) {
        if (graph.nodes.get(view.protectedIds[i])!.kind === 'question')
            phonePath.push(view.protectedIds[i + 1]);
    }
    state.phoneStartNodeId = view.protectedIds[0];
}

// The diagram text the main view draws: the whole file, or the blocks and arrows of the view.
export function buildMainViewSource(graph: EditorGraph): string {
    closeViewWithRemovedBlock(graph);
    renderPathViewControls();
    const view = state.pathView;
    if (!view) {
        if (state.functionsOnly)
            return filterToFunctions(codeBox.value);
        return codeBox.value;
    }
    // if (view.kind === 'downstream')
    //     return buildDownstreamSource(view, graph);
    // return buildOnePathSource(view, graph);
    const source = view.kind === 'downstream' ? buildDownstreamSource(view, graph) : buildOnePathSource(view, graph);
    // With no filter the phone view stays as it is.
    if (isViewLimitingEdits(view))
        showRouteInPhone(view, graph);
    return source;
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
    // if (!state.pathView)
    //     return false;
    if (!isViewLimitingEdits(state.pathView))
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
    // state.pathView = { kind: 'onePath', anchorId: null, startDigit: 0, decisionDigits: {}, pathIds: null, shownNodeIds: [], protectedIds: [] };
    state.pathView = { kind: 'onePath', clickedIds: [], clickHistory: [], startDigit: 0, decisionDigits: {}, pathIds: null, shownNodeIds: [], protectedIds: [] };
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

async function toggleDownstreamView() {
    if (state.pathView) {
        await closePathView();
        return;
    }
    state.pathView = { kind: 'downstream', clickedIds: [], clickHistory: [], startDigit: 0, decisionDigits: {}, pathIds: null, shownNodeIds: [], protectedIds: [] };
    await render();
    renderNodeInspector();
}

// A plain click on a block in the downstream view.
export async function filterDownstreamView(nodeId: string) {
    const view = state.pathView!;
    // const nextClickedIds = addFilterClick(view.clickedIds, view.protectedIds, nodeId);
    let nextClickedIds: string[];
    if (view.shownNodeIds.includes(nodeId))
        nextClickedIds = addFilterClick(view.clickedIds, view.protectedIds, nodeId);
    else {
        // A phone tap on a choice that is not drawn switches the branch at its decision.
        const edges: Edge[] = getEditorGraph().edges.map((edge) => [edge.from, edge.to]);
        nextClickedIds = [...addFilterClick(view.clickedIds, view.protectedIds, parentOf(nodeId, edges)), nodeId];
    }
    if (nextClickedIds !== view.clickedIds) {
        view.clickHistory.push(view.clickedIds);
        view.clickedIds = nextClickedIds;
    }
    codeBox.readOnly = true;
    await render();
    renderNodeInspector();
    moveNodeToViewportCenter(outputBox, diagramBox, nodeId);
}

async function undoFilterClick() {
    const view = state.pathView!;
    view.clickedIds = view.clickHistory.pop()!;
    codeBox.readOnly = isViewLimitingEdits(view);
    if (!view.clickedIds.length)
        clearPhoneAnswers();
    await render();
    renderNodeInspector();
}

async function resetDownstreamFilter() {
    const view = state.pathView!;
    view.clickedIds = [];
    view.clickHistory = [];
    codeBox.readOnly = false;
    clearPhoneAnswers();
    await render();
    renderNodeInspector();
}

function clearPhoneFocus() {
    state.phoneFocusNodeId = null;
    state.phoneFocusUsesDecisionContext = false;
    state.phonePreviewChoiceId = null;
}

// An empty filter shows the start in the phone, as the full diagram does.
function clearPhoneAnswers() {
    phonePath.length = 0;
    state.phoneStartNodeId = null;
    clearPhoneFocus();
}

// Draws the view the phone tap chose; a selected block that is no longer drawn loses the selection.
async function renderAfterPhoneTap() {
    await render();
    const isSelectionHidden = !!state.selectedEditorNodeId && !isNodeDrawn(state.selectedEditorNodeId);
    if (isSelectionHidden)
        selectEditorNode(null);
    else
        renderNodeInspector();
}

// The last decision on the one path that does not take its first choice. The start digit does not count.
export function findUndoDecisionId(view: PathView, graph: EditorGraph): string | undefined {
    const answeredIds = view.protectedIds.slice(0, -1).filter((id) => graph.nodes.get(id)!.kind === 'question');
    const changedIds = answeredIds.filter((id) => view.decisionDigits[id] !== 0);
    return changedIds[changedIds.length - 1];
}

// A tap on a phone button while a view is on. False means the button works as it does without a view.
export async function handlePhoneTapInPathView(button: HTMLButtonElement): Promise<boolean> {
    const view = state.pathView;
    if (!view)
        return false;
    const isUndo = button.dataset.undo !== undefined;
    // if (isUndo) {
    //     if (view.kind !== 'downstream')
    //         return false;
    //     if (!isViewLimitingEdits(view))
    //         return false;
    //     await undoFilterClick();
    //     return true;
    // }
    if (isUndo) {
        if (view.kind === 'downstream') {
            if (!isViewLimitingEdits(view))
                return false;
            await undoFilterClick();
            return true;
        }
        // // The one-path view: the last answered decision goes back to its first choice.
        // const graph = getEditorGraph();
        // const answeredIds = view.protectedIds.slice(0, -1).filter((id) => graph.nodes.get(id)!.kind === 'question');
        // view.decisionDigits[answeredIds[answeredIds.length - 1]] = 0;
        // The button is enabled only when such a decision exists.
        view.decisionDigits[findUndoDecisionId(view, getEditorGraph())!] = 0;
        await renderAfterPhoneTap();
        return true;
    }
    const isReset = button.dataset.resetDecisions !== undefined;
    // if (isReset) {
    //     if (view.kind !== 'downstream')
    //         return false;
    //     if (!isViewLimitingEdits(view))
    //         return false;
    //     await resetDownstreamFilter();
    //     return true;
    // }
    if (isReset) {
        if (view.kind === 'downstream') {
            if (!isViewLimitingEdits(view))
                return false;
            await resetDownstreamFilter();
            return true;
        }
        view.startDigit = 0;
        view.decisionDigits = {};
        await renderAfterPhoneTap();
        return true;
    }
    const isRevert = button.dataset.revert !== undefined;
    // With no filter a revert tap starts no filter; it works as in the full diagram.
    if (isRevert) {
        if (view.kind === 'downstream') {
            if (!isViewLimitingEdits(view))
                return false;
        }
    }
    const choiceId = isRevert ? button.dataset.revert!.split(':')[1] : button.dataset.choose!;
    const graph = getEditorGraph();
    const edges: Edge[] = graph.edges.map((edge) => [edge.from, edge.to]);
    const decisionId = parentOf(choiceId, edges);
    clearPhoneFocus();
    if (view.kind === 'downstream') {
        // A revert tap filters on the decision; a choice tap filters on the choice.
        const tappedId = isRevert ? decisionId : choiceId;
        selectEditorNode(tappedId);
        saveEditorViewState();
        await filterDownstreamView(tappedId);
        return true;
    }
    view.decisionDigits[decisionId] = choicesOf(decisionId, edges).indexOf(choiceId);
    // await render();
    // const isSelectionHidden = !!state.selectedEditorNodeId && !isNodeDrawn(state.selectedEditorNodeId);
    // if (isSelectionHidden)
    //     selectEditorNode(null);
    // else
    //     renderNodeInspector();
    // return true;
    await renderAfterPhoneTap();
    return true;
}

// Copies the command that prints the path on screen with print-path.ts.
async function copyPrintCommand(pathNumber: string, options: string) {
    await navigator.clipboard.writeText(`bun mermaid-editor/print-path.ts "${state.loadedPath}" --path ${pathNumber}${options}`);
}

function copyOnePathCommand() {
    const view = state.pathView!;
    const diagram = buildPathDiagram(getEditorGraph());
    copyPrintCommand(formatPathNumber(listViewDigits(view, diagram)), '');
}

function copyDownstreamCommand() {
    const view = state.pathView!;
    const diagram = buildPathDiagram(getEditorGraph());
    const latestId = view.clickedIds[view.clickedIds.length - 1];
    // copyPrintCommand(formatPathNumber(findRouteDigits(diagram, view.protectedIds)), ` --to ${latestId} --includeAfter`);
    // The button is disabled when no path number draws the route.
    copyPrintCommand(formatPathNumber(findRouteDigits(diagram, view.protectedIds)!), ` --to ${latestId} --includeAfter`);
}

copyPathCommandBtn.addEventListener('click', copyOnePathCommand);
copyDownstreamCommandBtn.addEventListener('click', copyDownstreamCommand);
onePathViewBtn.addEventListener('click', toggleOnePathView);
fullDiagramBtn.addEventListener('click', closePathView);
previousViewPathBtn.addEventListener('click', showPreviousViewPath);
nextViewPathBtn.addEventListener('click', showNextViewPath);
downstreamViewBtn.addEventListener('click', toggleDownstreamView);
backDownstreamViewBtn.addEventListener('click', undoFilterClick);
resetDownstreamViewBtn.addEventListener('click', resetDownstreamFilter);
