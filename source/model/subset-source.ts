import { buildClassStyleIndex } from './class-style-index.ts';
import { getDeclarationSuffix } from './editor-parse.ts';
import { parsePropsLine } from './node-props.ts';
import { buildPathEdges } from './path-view-model.ts';
import type { Edge } from '../../dom.ts';
import type { EditorGraph } from './editor-types.ts';

// Copies each used classDef line verbatim, then one class line per class for the declared nodes.
export function buildClassLines(source: string, declaredIds: Set<string>): string[] {
    const classIndex = buildClassStyleIndex(source);
    const idsByClass = new Map<string, string[]>();
    for (const id of declaredIds) {
        const className = classIndex.assignments.get(id);
        if (!className)
            continue;
        const classIds = idsByClass.get(className) ?? [];
        classIds.push(id);
        idsByClass.set(className, classIds);
    }
    const sourceLines = source.split('\n');
    const lines: string[] = [];
    for (const [className, classIds] of idsByClass) {
        const classDef = classIndex.defsByName.get(className);
        if (classDef)
            lines.push(`  ${sourceLines[classDef.lineIndex].trim()}`);
        lines.push(`  class ${classIds.join(',')} ${className}`);
    }
    return lines;
}

export function buildSubsetSource(graph: EditorGraph, nodeIds: string[], edges: Edge[]): string {
    const directionLine = graph.lines.find((line) => /^\s*(flowchart|graph)\b/.test(line))!;
    const lines = [directionLine.trim()];
    for (const id of nodeIds) {
        for (const line of graph.lines) {
            if (parsePropsLine(line)?.blockId === id)
                lines.push(line);
        }
        lines.push(`  ${id}${getDeclarationSuffix(graph.nodes.get(id)!)}`);
    }
    for (const [from, to] of edges) {
        const edge = graph.edges.find((candidate) => `${candidate.from} ${candidate.to}` === `${from} ${to}`)!;
        lines.push(edge.label ? `  ${from} -- "${edge.label}" --> ${to}` : `  ${from} --> ${to}`);
    }
    lines.push(...buildClassLines(graph.lines.join('\n'), new Set(nodeIds)));
    return lines.join('\n') + '\n';
}

// The diagram of one path, for the view on screen and for the exported path files.
export function buildPathSource(graph: EditorGraph, pathIds: string[]): string {
    return buildSubsetSource(graph, [...new Set(pathIds)], buildPathEdges(pathIds));
}
