import {
  GraphData,
  AnimationFrame,
  AlgorithmResult,
  FrameHighlight,
  NodeColorState,
  EdgeColorState,
  BellmanFordFrameData,
} from '../models/graph';

export function runBellmanFord(
  graph: GraphData,
  sourceId: string,
  targetId?: string
): AlgorithmResult {
  const frames: AnimationFrame[] = [];
  let frameIndex = 0;

  const nodeIds = graph.nodes.map((n) => n.id);
  const n = nodeIds.length;
  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  let hasNegativeCycle = false;
  let negativeCycleNodes: string[] = [];

  nodeIds.forEach((id) => {
    distances[id] = Infinity;
    previous[id] = null;
  });
  distances[sourceId] = 0;

  const createHighlight = (
    currentEdge?: string,
    relaxedEdges: string[] = [],
    inPath?: { nodes: string[]; edges: string[] },
    negCycleNodes: string[] = []
  ): FrameHighlight => {
    const nodeStates: Record<string, NodeColorState> = {};
    const edgeStates: Record<string, EdgeColorState> = {};

    graph.nodes.forEach((node) => {
      nodeStates[node.id] = 'default';
    });
    graph.edges.forEach((edge) => {
      edgeStates[edge.id] = 'default';
    });

    if (sourceId) nodeStates[sourceId] = 'source';
    if (targetId) nodeStates[targetId] = 'target';

    relaxedEdges.forEach((edgeId) => {
      if (edgeStates[edgeId] === 'default') {
        edgeStates[edgeId] = 'in-tree';
      }
    });

    if (currentEdge) {
      edgeStates[currentEdge] = 'relaxing';
      const edge = graph.edges.find((e) => e.id === currentEdge);
      if (edge) {
        if (edge.from !== sourceId && edge.from !== targetId && !negCycleNodes.includes(edge.from)) {
          nodeStates[edge.from] = 'visiting';
        }
        if (edge.to !== sourceId && edge.to !== targetId && !negCycleNodes.includes(edge.to)) {
          nodeStates[edge.to] = 'visited';
        }
      }
    }

    negCycleNodes.forEach((id) => {
      if (id !== sourceId && id !== targetId) {
        nodeStates[id] = 'visiting';
      }
    });

    if (inPath) {
      inPath.nodes.forEach((id) => {
        if (id !== sourceId && id !== targetId) {
          nodeStates[id] = 'in-path';
        }
      });
      inPath.edges.forEach((id) => {
        edgeStates[id] = 'in-path';
      });
    }

    return { nodeStates, edgeStates };
  };

  const addFrame = (
    description: string,
    currentIteration: number,
    currentEdge?: string,
    relaxedInIteration: string[] = [],
    inPath?: { nodes: string[]; edges: string[] },
    negCycleNodes: string[] = []
  ) => {
    const data: BellmanFordFrameData = {
      distances: { ...distances },
      previous: { ...previous },
      currentIteration,
      totalIterations: n - 1,
      currentEdge,
      relaxedInIteration: [...relaxedInIteration],
      hasNegativeCycle,
      negativeCycleNodes: negCycleNodes.length > 0 ? [...negCycleNodes] : undefined,
    };

    frames.push({
      index: frameIndex++,
      description,
      highlight: createHighlight(currentEdge, relaxedInIteration, inPath, negCycleNodes),
      data,
    });
  };

  addFrame(`初始化：源节点 ${sourceId} 距离设为 0，其他节点设为 ∞。共需 ${n - 1} 轮迭代`, 0);

  let globalRelaxedEdges: string[] = [];

  for (let i = 1; i <= n - 1; i++) {
    const relaxedInIteration: string[] = [];
    let updated = false;

    addFrame(`开始第 ${i} 轮迭代（共 ${n - 1} 轮）`, i);

    for (const edge of graph.edges) {
      const { from, to, weight, id } = edge;

      addFrame(
        `检查边 ${from}→${to}（权重=${weight}）：dist[${from}]=${distances[from] === Infinity ? '∞' : distances[from]}，dist[${to}]=${distances[to] === Infinity ? '∞' : distances[to]}`,
        i,
        id,
        relaxedInIteration
      );

      if (distances[from] !== Infinity && distances[from] + weight < distances[to]) {
        distances[to] = distances[from] + weight;
        previous[to] = from;
        relaxedInIteration.push(id);
        if (!globalRelaxedEdges.includes(id)) {
          globalRelaxedEdges.push(id);
        }
        updated = true;

        addFrame(
          `松弛成功！dist[${to}] 更新为 ${distances[to]}，前驱设为 ${from}`,
          i,
          id,
          relaxedInIteration
        );
      }
    }

    addFrame(
      `第 ${i} 轮迭代完成，共松弛 ${relaxedInIteration.length} 条边${!updated ? '，本轮无更新，可提前结束' : ''}`,
      i,
      undefined,
      relaxedInIteration
    );

    if (!updated) {
      addFrame(`提前终止：第 ${i} 轮无更新，最短路径已确定`, i);
      break;
    }
  }

  addFrame(`开始检测负环：进行第 ${n} 轮额外迭代`, n);

  for (const edge of graph.edges) {
    const { from, to, weight, id } = edge;

    addFrame(
      `负环检测：检查边 ${from}→${to}（权重=${weight}）`,
      n,
      id
    );

    if (distances[from] !== Infinity && distances[from] + weight < distances[to]) {
      hasNegativeCycle = true;

      const cycle: string[] = [];
      let visited = new Set<string>();
      let current = to;
      while (!visited.has(current)) {
        visited.add(current);
        current = previous[current] || from;
      }

      const cycleStart = current;
      cycle.push(cycleStart);
      current = previous[cycleStart] || from;
      while (current !== cycleStart) {
        cycle.unshift(current);
        current = previous[current] || from;
      }
      cycle.unshift(cycleStart);
      negativeCycleNodes = cycle;

      addFrame(
        `检测到负环！路径：${cycle.join(' → ')}，该环总权重为负数，最短路径无意义`,
        n,
        id,
        [],
        undefined,
        negativeCycleNodes
      );
      break;
    }
  }

  if (!hasNegativeCycle) {
    addFrame(`未检测到负环，算法完成`, n);
  }

  let path: string[] = [];
  let pathEdges: string[] = [];
  if (!hasNegativeCycle && targetId && distances[targetId] !== Infinity) {
    let current: string | null = targetId;
    while (current) {
      path.unshift(current);
      const prev: string | null = previous[current];
      if (prev) {
        const edge = graph.edges.find((e) => e.from === prev && e.to === current);
        if (edge) {
          pathEdges.unshift(edge.id);
        }
      }
      current = prev;
    }
    addFrame(
      `最短路径：${path.join(' → ')}，总距离：${distances[targetId]}`,
      n,
      undefined,
      [],
      { nodes: path, edges: pathEdges }
    );
  } else if (!hasNegativeCycle && targetId) {
    addFrame(`无法到达目标节点 ${targetId}`, n);
  }

  return {
    frames,
    summary: {
      type: 'bellman-ford',
      value: !hasNegativeCycle && targetId ? distances[targetId] : undefined,
      path: path.length > 0 ? path : undefined,
      hasNegativeCycle,
      negativeCycle: hasNegativeCycle ? negativeCycleNodes : undefined,
    },
  };
}
