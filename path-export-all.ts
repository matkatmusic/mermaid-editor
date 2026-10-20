import { codeBox } from './dom.ts';
import type { Edge } from './dom.ts';
import { parseEdges } from './diagram-source.ts';
import { setStatus } from './diagram-io.ts';
import { state } from './state.ts';
import { findRoot } from './phone-render.ts';
import { buildChosenPathSource } from './path-export.ts';
import { selectPathFolder, writeToOpenedFileFolder, writeToServerDiagrams } from './path-write.ts';

// Depth first: each edge is used once per path; a path ends where no unused edge leaves the node.
function collectPaths(path: string[], usedEdges: Set<string>, edges: Edge[], paths: string[][]) {
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

export function listAllPathIds(edges: Edge[]): string[][] {
  const paths: string[][] = [];
  const root = findRoot(edges);
  if (root === undefined)
    return paths;
  collectPaths([root], new Set(), edges, paths);
  return paths;
}

export async function writeAllPaths() {
  const sources: string[] = [];
  for (const ids of listAllPathIds(parseEdges(codeBox.value)))
    sources.push(buildChosenPathSource(ids));
  if (state.currentName) {
    setStatus(`Writing 0/${sources.length} paths`);
    for (let writtenCount = 1; writtenCount <= sources.length; writtenCount++) {
      await writeToServerDiagrams(state.currentName, sources[writtenCount - 1]);
      setStatus(`Writing ${writtenCount}/${sources.length} paths`);
    }
  }
  else {
    const openedFileName = state.openedFileHandle?.name ?? state.loadedPath?.split('/').pop();
    if (!openedFileName)
      throw new Error('Save the diagram before exporting all paths');
    const hasFolder = await selectPathFolder();
    if (!hasFolder) {
      console.log('User canceled Export all paths');
      return;
    }
    setStatus(`Writing 0/${sources.length} paths`);
    for (let writtenCount = 1; writtenCount <= sources.length; writtenCount++) {
      await writeToOpenedFileFolder(openedFileName, sources[writtenCount - 1]);
      setStatus(`Writing ${writtenCount}/${sources.length} paths`);
    }
  }
  setStatus(`Wrote ${sources.length} paths`);
}

document.getElementById('exportAllPathsBtn')!.addEventListener('click', writeAllPaths);
