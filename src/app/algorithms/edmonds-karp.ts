import {
  GraphData,
  AnimationFrame,
  AlgorithmResult,
  FrameHighlight,
  NodeColorState,
  EdgeColorState,
  EdmondsKarpFrameData,
} from '../models/graph';

interface ResidualEdge {
  id: string;
  from: string;
  to: string;
  capacity: number;
  original: boolean;
}

export function runEdmondsKarp(
  graph: GraphData,
  sourceId: string,
  targetId: string
): AlgorithmResult {
  const frames: AnimationFrame[] = [];
  let frameIndex = 0;

  const nodeIds = graph.nodes.map((n) => n.id);

  const residualCapacity: Record<string, number> = {};
  const flow: Record<string, number> = {};
  const residualEdges: ResidualEdge[] = [];
  const adjacency = new Map<string, ResidualEdge[]>();

  graph.edges.forEach((edge) => {
    const forward: ResidualEdge = {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      capacity: edge.capacity ?? edge.weight,
      original: true,
    };
    residualEdges.push(forward);
    residualCapacity[edge.id] = edge.capacity ?? edge.weight;
    flow[edge.id] = 0;

    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(forward);

    const backwardId = `${edge.id}_rev`;
    const backward: ResidualEdge = {
      id: backwardId,
      from: edge.to,
      to: edge.from,
      capacity: 0,
      original: false,
    };
    residualEdges.push(backward);
    residualCapacity[backwardId] = 0;

    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
    adjacency.get(edge.to)!.push(backward);
  });

  let maxFlowSoFar = 0;
  let minCutS: string[] = [];
  let minCutT: string[] = [];

  const createHighlight = (
    augmentingPath: string[] = [],
    currentEdgeInBFS?: string,
    visitedInBFS: string[] = [],
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

    visitedInBFS.forEach((id) => {
      if (id !== sourceId && id !== targetId && !augmentingPath.includes(id)) {
        nodeStates[id] = 'visited';
      }
    });

    augmentingPath.forEach((id) => {
      if (id !== sourceId && id !== targetId) {
        nodeStates[id] = 'visiting';
      }
    });

    for (let i = 0; i < augmentingPath.length - 1; i++) {
      const from = augmentingPath[i];
      const to = augmentingPath[i + 1];
      const edge = graph.edges.find((e) => e.from === from && e.to === to);
      const revEdge = graph.edges.find((e) => e.from === to && e.to === from);
      if (edge) {
        edgeStates[edge.id] = 'augmenting';
      } else if (revEdge) {
        edgeStates[revEdge.id] = 'residual';
      }
    }

    if (currentEdgeInBFS) {
      if (edgeStates[currentEdgeInBFS] === 'default') {
        edgeStates[currentEdgeInBFS] = 'residual';
      }
    }

    graph.edges.forEach((edge) => {
      if (edgeStates[edge.id] === 'default') {
        const cap = residualCapacity[edge.id];
        if (cap === 0) {
          edgeStates[edge.id] = 'saturated';
        } else if (flow[edge.id] > 0) {
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
    augmentingPath: string[] = [],
    currentEdgeInBFS?: string,
    visitedInBFS: string[] = [],
    inPath?: { nodes: string[]; edges: string[] }
  ) => {
    const data: EdmondsKarpFrameData = {
      residualCapacity: { ...residualCapacity },
      flow: { ...flow },
      augmentingPath: [...augmentingPath],
      currentEdgeInBFS,
      visitedInBFS: [...visitedInBFS],
      maxFlowSoFar,
      minCutS: minCutS.length > 0 ? [...minCutS] : undefined,
      minCutT: minCutT.length > 0 ? [...minCutT] : undefined,
    };

    frames.push({
      index: frameIndex++,
      description,
      highlight: createHighlight(augmentingPath, currentEdgeInBFS, visitedInBFS, inPath),
      data,
    });
  };

  addFrame(`初始化最大流问题：源点 ${sourceId}，汇点 ${targetId}。残量网络已构建`);

  const bfs = (): { path: string[]; bottleneck: number } | null => {
    const visited = new Set<string>();
    const parent = new Map<string, { node: string; edge: ResidualEdge } | null>();
    const queue: string[] = [sourceId];
    visited.add(sourceId);
    parent.set(sourceId, null);

    addFrame(`开始 BFS 寻找增广路径，从 ${sourceId} 出发`, [], undefined, [sourceId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current) || [];

      for (const edge of neighbors) {
        if (visited.has(edge.to)) continue;
        if (residualCapacity[edge.id] <= 0) continue;

        const originalEdge = graph.edges.find((e) => e.id === edge.id || `${e.id}_rev` === edge.id);
        const displayEdgeId = originalEdge ? originalEdge.id : edge.id;

        addFrame(
          `BFS 探索：节点 ${current} → 节点 ${edge.to}，残量容量=${residualCapacity[edge.id]}`,
          [],
          displayEdgeId,
          Array.from(visited)
        );

        visited.add(edge.to);
        parent.set(edge.to, { node: current, edge });
        queue.push(edge.to);

        if (edge.to === targetId) {
          const path: string[] = [];
          let bottleneck = Infinity;
          let node: string | null = targetId;

          while (node) {
            path.unshift(node);
            const p = parent.get(node);
            if (!p) break;
            bottleneck = Math.min(bottleneck, residualCapacity[p.edge.id]);
            node = p.node;
          }

          return { path, bottleneck };
        }
      }
    }

    minCutS = Array.from(visited);
    minCutT = nodeIds.filter((id) => !visited.has(id));

    return null;
  };

  let augmentCount = 0;
  while (true) {
    const result = bfs();

    if (!result) {
      addFrame(
        `BFS 完成：未找到增广路径。算法结束。最大流 = ${maxFlowSoFar}`,
        [],
        undefined,
        minCutS
      );
      break;
    }

    augmentCount++;
    const { path, bottleneck } = result;

    addFrame(
      `找到第 ${augmentCount} 条增广路径：${path.join(' → ')}，瓶颈容量 = ${bottleneck}`,
      path
    );

    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];

      const forwardEdge = residualEdges.find(
        (e) => e.from === from && e.to === to && e.original
      );
      const backwardEdge = residualEdges.find(
        (e) => e.from === from && e.to === to && !e.original
      );

      if (forwardEdge) {
        residualCapacity[forwardEdge.id] -= bottleneck;
        flow[forwardEdge.id] += bottleneck;
        const revId = `${forwardEdge.id}_rev`;
        residualCapacity[revId] = (residualCapacity[revId] || 0) + bottleneck;

        addFrame(
          `增广边 ${from}→${to}：流量 +${bottleneck}，正向残量=${residualCapacity[forwardEdge.id]}，反向残量=${residualCapacity[revId]}`,
          path,
          forwardEdge.id
        );
      } else if (backwardEdge) {
        const originalId = backwardEdge.id.replace('_rev', '');
        residualCapacity[backwardEdge.id] -= bottleneck;
        flow[originalId] -= bottleneck;
        residualCapacity[originalId] = (residualCapacity[originalId] || 0) + bottleneck;

        const displayEdge = graph.edges.find((e) => e.id === originalId);
        addFrame(
          `反向增广 ${from}→${to}（回退流量）：流量 -${bottleneck}，正向残量=${residualCapacity[originalId]}，反向残量=${residualCapacity[backwardEdge.id]}`,
          path,
          displayEdge ? displayEdge.id : originalId
        );
      }
    }

    maxFlowSoFar += bottleneck;
    addFrame(
      `第 ${augmentCount} 轮增广完成，当前最大流 = ${maxFlowSoFar}`,
      path
    );
  }

  const minCutEdges: string[] = [];
  graph.edges.forEach((edge) => {
    if (minCutS.includes(edge.from) && minCutT.includes(edge.to)) {
      minCutEdges.push(edge.id);
    }
  });

  addFrame(
    `最小割：S = {${minCutS.join(', ')}}，T = {${minCutT.join(', ')}}，割边：${minCutEdges.join(', ')}，割值 = ${maxFlowSoFar}`,
    [],
    undefined,
    minCutS,
    { nodes: minCutS, edges: minCutEdges }
  );

  return {
    frames,
    summary: {
      type: 'edmonds-karp',
      maxFlow: maxFlowSoFar,
      minCut: minCutS.length > 0 ? { S: minCutS, T: minCutT } : undefined,
    },
  };
}
