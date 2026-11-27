import type { Edge } from './dom.ts';
import type { EditorGraph } from './editor-types.ts';

// Each arrow between two neighbor blocks of the path, once.
export function buildPathEdges(pathIds: string[]): Edge[] {
    const edges: Edge[] = [];
    const listedKeys = new Set<string>();
    for (let i = 0; i + 1 < pathIds.length; i++) {
        const key = `${pathIds[i]} ${pathIds[i + 1]}`;
        if (listedKeys.has(key))
            continue;
        listedKeys.add(key);
        edges.push([pathIds[i], pathIds[i + 1]]);
    }
    return edges;
}

// Every arrow that can be reached from the anchor block, once, nearest first.
export function collectDownstreamEdges(anchorId: string, edges: Edge[]): Edge[] {
    const downstreamEdges: Edge[] = [];
    const reachedIds = new Set([anchorId]);
    // A Set that grows during the loop is also visited, so this walks the blocks breadth first.
    for (const id of reachedIds) {
        for (const [from, to] of edges) {
            if (from !== id)
                continue;
            downstreamEdges.push([from, to]);
            reachedIds.add(to);
        }
    }
    return downstreamEdges;
}

export type PathViewKind = 'onePath' | 'downstream';

export interface PathView {
    kind: PathViewKind;
    anchorId: string | null;
    // // null is the downstream view of all paths.
    // pathNumber: number | null;
    // The one-path view's number: which start block, then one choice index for each decision.
    startDigit: number;
    decisionDigits: Record<string, number>;
    pathIds: string[] | null;
    shownNodeIds: string[];
    protectedIds: string[];
}

// export interface NumberedPath {
//     pathNumber: number;
//     pathIds: string[];
//     hasNextPath: boolean;
// }

// function* walkPathsFrom(path: string[], usedEdges: Set<string>, edges: Edge[]): Generator<string[]> {
//     const current = path[path.length - 1];
//     let hasUnusedEdge = false;
//     for (const [from, to] of edges) {
//         if (from !== current)
//             continue;
//         const edgeKey = `${from}->${to}`;
//         if (usedEdges.has(edgeKey))
//             continue;
//         hasUnusedEdge = true;
//         usedEdges.add(edgeKey);
//         path.push(to);
//         yield* walkPathsFrom(path, usedEdges, edges);
//         path.pop();
//         usedEdges.delete(edgeKey);
//     }
//     if (!hasUnusedEdge)
//         yield [...path];
// }

// // One path at a time, depth first, each arrow once per path: the order of Export all paths.
// export function* walkPaths(startIds: string[], edges: Edge[]): Generator<string[]> {
//     for (const startId of startIds)
//         yield* walkPathsFrom([startId], new Set(), edges);
// }

// // The path with this number, or the last path when there are fewer. It walks one path further to know if a next path exists.
// export function findPathByNumber(startIds: string[], edges: Edge[], pathNumber: number): NumberedPath {
//     let found: NumberedPath | undefined;
//     for (const pathIds of walkPaths(startIds, edges)) {
//         if (found?.pathNumber === pathNumber) {
//             found.hasNextPath = true;
//             break;
//         }
//         const nextNumber = (found?.pathNumber ?? 0) + 1;
//         found = { pathNumber: nextNumber, pathIds, hasNextPath: false };
//     }
//     if (!found)
//         throw new Error('The diagram has no path from a start block');
//     return found;
// }

export type ViewEdit = 'removeNode' | 'removeChoices' | 'changeDestination' | 'connectNodes' | 'addStandaloneBlock' | 'addStaticAfter' | 'insertStaticAfter' | 'addChoice';

// The reason an edit is refused while a view is on; null means the edit is allowed.
export function findViewEditRefusal(view: PathView | null, graph: EditorGraph, edit: ViewEdit, nodeId: string | null): string | null {
    if (!view)
        return null;
    if (edit === 'addChoice') {
        if (view.kind === 'onePath')
            return 'Show the full diagram to add a choice.';
        return null;
    }
    if (edit === 'insertStaticAfter') {
        if (graph.nodes.get(nodeId!)!.kind === 'choice') {
            if (!view.protectedIds.includes(nodeId!))
                return 'This choice is not on the shown path.';
        }
        return null;
    }
    if (edit !== 'removeNode')
        return 'Show the full diagram to make this change.';
    const kind = graph.nodes.get(nodeId!)!.kind;
    if (kind === 'question')
        return 'Show the full diagram to remove a decision.';
    if (kind === 'choice') {
        if (view.protectedIds.includes(nodeId!))
            return 'This choice is on the shown path.';
        return null;
    }
    const isEndOfShownPath = view.pathIds ? view.pathIds[view.pathIds.length - 1] === nodeId : !graph.edges.some((edge) => edge.from === nodeId);
    if (isEndOfShownPath)
        return 'This is the last block of the path.';
    return null;
}

export function choicesOf(id: string, edges: Edge[]): string[] {
    const found: string[] = [];
    for (const [from, to] of edges) {
        if (from === id)
            found.push(to);
    }
    return found;
}

// The loop rule of every path walk: a path uses each arrow once, and ends where no unused arrow leaves the block.
export function findUnusedChoices(id: string, usedEdges: Set<string>, edges: Edge[]): string[] {
    return choicesOf(id, edges).filter((to) => !usedEdges.has(`${id}->${to}`));
}

// One hex digit holds this many choices.
const MAX_CHOICES = 16;

export interface PathDiagram {
    startIds: string[];
    edges: Edge[];
    // The decisions in file order: one path digit each, after the start block digit.
    decisionIds: string[];
}

export interface DigitPath {
    pathIds: string[];
    // The digits of this path; a decision that the path does not reach shows 0.
    digits: number[];
}

// The largest value of each digit: the start block first, then each decision.
export function listDigitMaximums(diagram: PathDiagram): number[] {
    if (!diagram.startIds.length)
        throw new Error('The diagram has no path from a start block');
    const counts = [diagram.startIds.length, ...diagram.decisionIds.map((id) => choicesOf(id, diagram.edges).length)];
    for (const count of counts) {
        if (count > MAX_CHOICES)
            throw new Error(`A path digit holds ${MAX_CHOICES} choices; the diagram needs ${count}`);
    }
    return counts.map((count) => Math.max(count - 1, 0));
}

export function walkDigitPath(diagram: PathDiagram, digits: number[]): DigitPath {
    const reachedDigits = digits.map(() => 0);
    reachedDigits[0] = digits[0];
    const pathIds = [diagram.startIds[digits[0]]];
    const usedEdges = new Set<string>();
    for (;;) {
        const current = pathIds[pathIds.length - 1];
        const unusedChoices = findUnusedChoices(current, usedEdges, diagram.edges);
        if (!unusedChoices.length)
            return { pathIds, digits: reachedDigits };
        let next = unusedChoices[0];
        const position = diagram.decisionIds.indexOf(current) + 1;
        if (position > 0) {
            reachedDigits[position] = digits[position];
            const namedChoice = choicesOf(current, diagram.edges)[digits[position]];
            if (unusedChoices.includes(namedChoice))
                next = namedChoice;
        }
        usedEdges.add(`${current}->${next}`);
        pathIds.push(next);
    }
}

// Positive when a is the larger number; the leftmost digit counts most.
function compareDigits(a: number[], b: number[]) {
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i])
            return a[i] - b[i];
    }
    return 0;
}

// The nearest path number after (step 1) or before (step -1) the given one, or null. Every returned number draws its own path.
// It searches the walk, not the numbers: counting through the numbers took up to 509952 walks for one step.
export function findNeighbourDigits(diagram: PathDiagram, digits: number[], step: 1 | -1): number[] | null {
    const maximums = listDigitMaximums(diagram);
    let nearest: number[] | null = null;

    // True when no path with these chosen digits can lie between the given number and the nearest one found.
    function isOutOfRange(chosen: (number | undefined)[]) {
        const lowest = maximums.map((_, i) => chosen[i] ?? 0);
        const highest = maximums.map((maximum, i) => chosen[i] ?? maximum);
        const farthest = step === 1 ? highest : lowest;
        const closest = step === 1 ? lowest : highest;
        if (compareDigits(farthest, digits) * step <= 0)
            return true;
        if (nearest) {
            if (compareDigits(closest, nearest) * step >= 0)
                return true;
        }
        return false;
    }

    function keepIfNearer(chosen: (number | undefined)[]) {
        const found = maximums.map((_, i) => chosen[i] ?? 0);
        if (compareDigits(found, digits) * step <= 0)
            return;
        if (nearest) {
            if (compareDigits(found, nearest) * step >= 0)
                return;
        }
        nearest = found;
    }

    function searchFrom(startId: string, usedEdges: Set<string>, chosen: (number | undefined)[]) {
        let current = startId;
        for (;;) {
            const unusedChoices = findUnusedChoices(current, usedEdges, diagram.edges);
            if (!unusedChoices.length) {
                keepIfNearer(chosen);
                return;
            }
            let next = unusedChoices[0];
            const position = diagram.decisionIds.indexOf(current) + 1;
            if (position > 0) {
                if (chosen[position] === undefined) {
                    searchEachDigit(current, position, usedEdges, chosen);
                    return;
                }
                const namedChoice = choicesOf(current, diagram.edges)[chosen[position]!];
                if (unusedChoices.includes(namedChoice))
                    next = namedChoice;
            }
            usedEdges.add(`${current}->${next}`);
            current = next;
        }
    }

    // The first visit of a decision: search every digit it can have, the closest first.
    function searchEachDigit(decisionId: string, position: number, usedEdges: Set<string>, chosen: (number | undefined)[]) {
        const values = choicesOf(decisionId, diagram.edges).map((_, digit) => digit);
        if (step === -1)
            values.reverse();
        for (const digit of values) {
            const branchChosen = [...chosen];
            branchChosen[position] = digit;
            if (isOutOfRange(branchChosen))
                continue;
            searchFrom(decisionId, new Set(usedEdges), branchChosen);
        }
    }

    const startDigits = diagram.startIds.map((_, digit) => digit);
    if (step === -1)
        startDigits.reverse();
    for (const startDigit of startDigits) {
        const chosen: (number | undefined)[] = [startDigit];
        if (isOutOfRange(chosen))
            continue;
        searchFrom(diagram.startIds[startDigit], new Set(), chosen);
    }
    return nearest;
}
