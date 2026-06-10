import {
  GraphData,
  AnimationFrame,
  AlgorithmResult,
  FrameHighlight,
  NodeColorState,
  EdgeColorState,
  DijkstraFrameData,
} from '../models/graph';

export function runDijkstra(
  graph: GraphData,
  sourceId: string,
  targetId?: string
): AlgorithmResult {
  const frames: AnimationFrame[] = [];
  let frameIndex = 0;

  const nodeIds = graph.nodes.map((n) => n.id);
  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const settledNodes: string[] = [];
  const priorityQueue: { node: string; dist: number }[] = [];

  const edgeMap = new Map<string, { from: string; to: string; weight: number; id: string }[]>();
  graph.edges.forEach((edge) => {
    if (!edgeMap.has(edge.from)) {
      edgeMap.set(edge.from, []);
    }
    edgeMap.get(edge.from)!.push({
      from: edge.from,
      to: edge.to,
      weight: edge.weight,
      id: edge.id,
    });
  });

  nodeIds.forEach((id) => {
    distances[id] = Infinity;
    previous[id] = null;
  });
  distances[sourceId] = 0;
  priorityQueue.push({ node: sourceId, dist: 0 });

  const createHighlight = (
    currentNode?: string,
    relaxingEdge?: string,
    inPath?: { nodes: string[]; edges: string[] }
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

    settledNodes.forEach((id) => {
      if (id !== sourceId && id !== targetId) {
        nodeStates[id] = 'settled';
      }
    });

    if (currentNode && currentNode !== sourceId && currentNode !== targetId) {
      nodeStates[currentNode] = 'visiting';
    }

    if (relaxingEdge) {
      edgeStates[relaxingEdge] = 'relaxing';
    }

    graph.edges.forEach((edge) => {
      if (previous[edge.to] === edge.from) {
        if (edgeStates[edge.id] === 'default') {
          edgeStates[edge.id] = 'in-tree';
        }
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
    currentNode?: string,
    relaxingEdge?: string,
    inPath?: { nodes: string[]; edges: string[] }
  ) => {
    const data: DijkstraFrameData = {
      distances: { ...distances },
      previous: { ...previous },
      priorityQueue: priorityQueue.map((p) => ({ ...p })),
      currentNode,
      relaxingEdge,
      settledNodes: [...settledNodes],
    };

    frames.push({
      index: frameIndex++,
      description,
      highlight: createHighlight(currentNode, relaxingEdge, inPath),
      data,
    });
  };

  addFrame(`初始化：源节点 ${sourceId} 距离设为 0，其他节点设为 ∞`);

  while (priorityQueue.length > 0) {
    priorityQueue.sort((a, b) => a.dist - b.dist);
    const current = priorityQueue.shift()!;

    if (settledNodes.includes(current.node)) {
      addFrame(`跳过节点 ${current.node}（已确定最短路径）`);
      continue;
    }

    settledNodes.push(current.node);
    addFrame(
      `从优先队列取出距离最小的节点 ${current.node}（距离=${current.dist}），标记为已确定`
    );

    if (targetId && current.node === targetId) {
      addFrame(`到达目标节点 ${targetId}，算法结束`);
      break;
    }

    const neighbors = edgeMap.get(current.node) || [];
    for (const edge of neighbors) {
      if (settledNodes.includes(edge.to)) {
        continue;
      }

      const newDist = distances[current.node] + edge.weight;
      addFrame(
        `检查边 ${edge.from}→${edge.to}（权重=${edge.weight}）：当前距离 ${distances[edge.to] === Infinity ? '∞' : distances[edge.to]}，新距离 ${distances[current.node]} + ${edge.weight} = ${newDist}`,
        current.node,
        edge.id
      );

      if (newDist < distances[edge.to]) {
        distances[edge.to] = newDist;
        previous[edge.to] = current.node;
        priorityQueue.push({ node: edge.to, dist: newDist });
        addFrame(
          `松弛成功！更新节点 ${edge.to} 的距离为 ${newDist}，前驱设为 ${current.node}`,
          current.node,
          edge.id
        );
      } else {
        addFrame(
          `无需更新：${newDist} ≥ ${distances[edge.to]}`,
          current.node,
          edge.id
        );
      }
    }
  }

  let path: string[] = [];
  let pathEdges: string[] = [];
  if (targetId && distances[targetId] !== Infinity) {
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
    addFrame(`最短路径：${path.join(' → ')}，总距离：${distances[targetId]}`, undefined, undefined, {
      nodes: path,
      edges: pathEdges,
    });
  } else if (targetId) {
    addFrame(`无法到达目标节点 ${targetId}`);
  }

  return {
    frames,
    summary: {
      type: 'dijkstra',
      value: targetId ? distances[targetId] : undefined,
      path: path.length > 0 ? path : undefined,
    },
  };
}
