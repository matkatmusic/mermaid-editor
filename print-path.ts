// Prints one path of a diagram as Mermaid source. A path number is the number that the one-path view shows.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parseEditorGraph } from './editor-graph-parse.ts';
import { buildSourceWithPropsLines } from './file-format.ts';
import { buildPathDiagram, findPrintedRoute, listRouteAndDownstreamEdges, parsePathNumber } from './path-view-model.ts';
import { buildPathSource, buildSubsetSource } from './subset-source.ts';

const USAGE = 'Usage: bun print-path.ts <diagram.mmd> --path 0x01A [--to <blockId>] [--includeAfter]';

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { path: { type: 'string' }, to: { type: 'string' }, includeAfter: { type: 'boolean' } },
});
if (positionals.length !== 1)
    throw new Error(USAGE);
if (values.path === undefined)
    throw new Error(USAGE);
// The conversion turns the lines of an old file format into the lines that the parser reads today.
const { graph, problems } = parseEditorGraph(buildSourceWithPropsLines(readFileSync(positionals[0], 'utf8')));
if (problems.length)
    throw new Error(problems.join('\n'));
const diagram = buildPathDiagram(graph);
const digits = parsePathNumber(values.path, diagram);
if (values.to !== undefined) {
    if (!graph.nodes.has(values.to))
        throw new Error(`Unknown block ${values.to}`);
}
const routeIds = findPrintedRoute(diagram, digits, values.to);
if (values.includeAfter) {
    const edges = listRouteAndDownstreamEdges(routeIds, diagram.edges);
    process.stdout.write(buildSubsetSource(graph, [...new Set([...routeIds, ...edges.flat()])], edges));
}
else
    process.stdout.write(buildPathSource(graph, routeIds));
