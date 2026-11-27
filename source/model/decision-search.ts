import type { EditorGraph } from './editor-types.ts';

export function findNearestDecision(id: string, step: 1 | -1, graph: EditorGraph) {
  const visited = new Set([id]);
  let frontier = [id];
  while (frontier.length) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      for (const edge of graph.edges) {
        const neighbor = step === 1
          ? edge.from === nodeId ? edge.to : null
          : edge.to === nodeId ? edge.from : null;
        const isMissing = !neighbor;
        const isVisited = visited.has(neighbor as string);
        const shouldSkip = isMissing || isVisited;
        if (shouldSkip)
          continue;
        visited.add(neighbor!);
        const isQuestion = graph.nodes.get(neighbor!)?.kind === 'question';
        if (isQuestion)
          return graph.nodes.get(neighbor!);
        nextFrontier.push(neighbor!);
      }
    }
    frontier = nextFrontier;
  }
}

export function findNearestFeedingChoice(id: string, graph: EditorGraph) {
  const visited = new Set([id]);
  let frontier = [id];
  while (frontier.length) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      const node = graph.nodes.get(nodeId);
      const isChoice = node?.kind === 'choice';
      const isQuestion = node?.kind === 'question';
      const isAnswerKind = isChoice || isQuestion;
      let isFedByDecision = false;
      for (const edge of graph.edges) {
        const targetsNode = edge.to === nodeId;
        const isFromDecision = graph.nodes.get(edge.from)?.kind === 'question';
        const isFeeder = targetsNode && isFromDecision;
        if (isFeeder) {
          isFedByDecision = true;
          break;
        }
      }
      const isChoiceFedByDecision = isAnswerKind && isFedByDecision;
      if (isChoiceFedByDecision)
        return nodeId;
      for (const edge of graph.edges) {
        const isOtherNode = edge.to !== nodeId;
        const isVisited = visited.has(edge.from);
        const shouldSkip = isOtherNode || isVisited;
        if (shouldSkip)
          continue;
        visited.add(edge.from);
        nextFrontier.push(edge.from);
      }
    }
    frontier = nextFrontier;
  }
  return null;
}
