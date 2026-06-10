import {
  GraphData,
  AnimationFrame,
  AlgorithmResult,
  FrameHighlight,
  NodeColorState,
  EdgeColorState,
  MinCostFlowFrameData,
} from '../models/graph';

interface ResidualEdge {
  id: string;
  from: string;
  to: string;
  capacity: number;
  cost: number;
  original: boolean;
  originalId?: string;
}

export function runMinCostMaxFlow(
  graph: GraphData,
  sourceId: string,
  targetId: string
): AlgorithmResult {
  const frames: AnimationFrame[] = [];
  let frameIndex = 0;

  const nodeIds = graph.nodes.map((n) => n.id);

  const residualCapacity: Record<string, number> = {};
  const residualCost: Record<string, number> = {};
  const flow: Record<string, number> = {};
  const residualEdges: ResidualEdge[] = [];
  const adjacency = new Map<string, ResidualEdge[]>();

  graph.edges.forEach((edge) => {
    const cap = edge.capacity ?? edge.weight;
    const cost = edge.cost ?? 0;

    const forward: ResidualEdge = {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      capacity: cap,
      cost,
      original: true,
      originalId: edge.id,
    };
    residualEdges.push(forward);
    residualCapacity[edge.id] = cap;
    residualCost[edge.id] = cost;
    flow[edge.id] = 0;

    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(forward);

    const backwardId = `${edge.id}_rev`;
    const backward: ResidualEdge = {
      id: backwardId,
      from: edge.to,
      to: edge.from,
      capacity: 0,
      cost: -cost,
      original: false,
      originalId: edge.id,
    };
    residualEdges.push(backward);
    residualCapacity[backwardId] = 0;
    residualCost[backwardId] = -cost;

    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
    adjacency.get(edge.to)!.push(backward);
  });

  const distances: Record<string, number> = {};
  const potential: Record<string, number> = {};
  nodeIds.forEach((id) => {
    potential[id] = 0;
  });

  let flowSoFar = 0;
  let costSoFar = 0;

  const createHighlight = (
    augmentingPath: string[] = [],
    currentEdgeInSPFA?: string,
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

    if (currentEdgeInSPFA && edgeStates[currentEdgeInSPFA] === 'default') {
      edgeStates[currentEdgeInSPFA] = 'relaxing';
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
    currentEdgeInSPFA?: string,
    inPath?: { nodes: string[]; edges: string[] }
  ) => {
    const data: MinCostFlowFrameData = {
      residualCapacity: { ...residualCapacity },
      residualCost: { ...residualCost },
      flow: { ...flow },
      distances: { ...distances },
      potential: { ...potential },
      augmentingPath: [...augmentingPath],
      flowSoFar,
      costSoFar,
      currentEdgeInSPFA,
    };

    frames.push({
      index: frameIndex++,
      description,
      highlight: createHighlight(augmentingPath, currentEdgeInSPFA, inPath),
      data,
    });
  };

  addFrame(
    `初始化最小费用最大流：源点 ${sourceId}，汇点 ${targetId}。使用 Johnson 势函数 + SPFA 寻找最小费用增广路`
  );

  const spfa = (): { path: string[]; bottleneck: number; pathCost: number } | null => {
    nodeIds.forEach((id) => {
      distances[id] = Infinity;
    });
    distances[sourceId] = 0;

    const inQueue = new Set<string>();
    const parent = new Map<string, { node: string; edge: ResidualEdge } | null>();
    const queue: string[] = [sourceId];
    inQueue.add(sourceId);
    parent.set(sourceId, null);

    addFrame(`开始 SPFA：从 ${sourceId} 出发，使用势函数 h(v) 重新赋权避免负权边`);

    while (queue.length > 0) {
      const current = queue.shift()!;
      inQueue.delete(current);

      const neighbors = adjacency.get(current) || [];
      for (const edge of neighbors) {
        if (residualCapacity[edge.id] <= 0) continue;

        const reducedCost = residualCost[edge.id] + potential[current] - potential[edge.to];
        const newDist = distances[current] + reducedCost;

        const displayEdge = graph.edges.find(
          (e) => e.id === edge.id || `${e.id}_rev` === edge.id
        );
        const displayEdgeId = displayEdge ? displayEdge.id : edge.id;

        addFrame(
          `SPFA 松弛：${current}→${edge.to}，约化费用=${reducedCost}，当前 dist[${edge.to}]=${distances[edge.to] === Infinity ? '∞' : distances[edge.to]}，新 dist=${newDist}`,
          [],
          displayEdgeId
        );

        if (newDist < distances[edge.to]) {
          distances[edge.to] = newDist;
          parent.set(edge.to, { node: current, edge });

          if (!inQueue.has(edge.to)) {
            queue.push(edge.to);
            inQueue.add(edge.to);
          }

          addFrame(
            `更新成功！dist[${edge.to}] = ${newDist}`,
            [],
            displayEdgeId
          );
        }
      }
    }

    if (distances[targetId] === Infinity) {
      return null;
    }

    nodeIds.forEach((id) => {
      if (distances[id] < Infinity) {
        potential[id] += distances[id];
      }
    });

    const path: string[] = [];
    let bottleneck = Infinity;
    let pathCost = 0;
    let node: string | null = targetId;

    while (node) {
      path.unshift(node);
      const p = parent.get(node);
      if (!p) break;
      bottleneck = Math.min(bottleneck, residualCapacity[p.edge.id]);
      pathCost += residualCost[p.edge.id];
      node = p.node;
    }

    return { path, bottleneck, pathCost };
  };

  let augmentCount = 0;
  while (true) {
    const result = spfa();

    if (!result) {
      addFrame(
        `SPFA 完成：未找到增广路径。算法结束。总流量 = ${flowSoFar}，总费用 = ${costSoFar}`
      );
      break;
    }

    augmentCount++;
    const { path, bottleneck, pathCost } = result;

    addFrame(
      `找到第 ${augmentCount} 条最小费用增广路：${path.join(' → ')}，瓶颈 = ${bottleneck}，单位路径费用 = ${pathCost}`,
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
          `增广边 ${from}→${to}：流量 +${bottleneck}，费用 +${bottleneck}×${residualCost[forwardEdge.id]}=${bottleneck * residualCost[forwardEdge.id]}`,
          path,
          forwardEdge.id
        );
      } else if (backwardEdge && backwardEdge.originalId) {
        const originalId = backwardEdge.originalId;
        residualCapacity[backwardEdge.id] -= bottleneck;
        flow[originalId] -= bottleneck;
        residualCapacity[originalId] = (residualCapacity[originalId] || 0) + bottleneck;

        addFrame(
          `反向增广 ${from}→${to}（回退流量）：流量 -${bottleneck}，退回费用 ${bottleneck}×${Math.abs(residualCost[backwardEdge.id])}`,
          path,
          originalId
        );
      }
    }

    flowSoFar += bottleneck;
    costSoFar += bottleneck * pathCost;
    addFrame(
      `第 ${augmentCount} 轮增广完成：当前流量 = ${flowSoFar}，累计费用 = ${costSoFar}`,
      path
    );
  }

  const finalEdges: string[] = [];
  graph.edges.forEach((edge) => {
    if (flow[edge.id] > 0) {
      finalEdges.push(edge.id);
    }
  });

  addFrame(
    `最小费用最大流结果：最大流量 = ${flowSoFar}，最小总费用 = ${costSoFar}`,
    [],
    undefined,
    { nodes: nodeIds.filter((id) => id !== sourceId && id !== targetId), edges: finalEdges }
  );

  return {
    frames,
    summary: {
      type: 'min-cost-max-flow',
      totalFlow: flowSoFar,
      totalCost: costSoFar,
    },
  };
}
