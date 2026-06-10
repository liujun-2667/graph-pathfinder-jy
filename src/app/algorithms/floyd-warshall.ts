import {
  GraphData,
  AnimationFrame,
  AlgorithmResult,
  FrameHighlight,
  NodeColorState,
  EdgeColorState,
  FloydWarshallFrameData,
} from '../models/graph';

export function runFloydWarshall(
  graph: GraphData,
  sourceId?: string,
  targetId?: string
): AlgorithmResult {
  const frames: AnimationFrame[] = [];
  let frameIndex = 0;

  const nodeIds = graph.nodes.map((n) => n.id);
  const n = nodeIds.length;
  const nodeIndexMap = new Map<string, number>();
  nodeIds.forEach((id, idx) => nodeIndexMap.set(id, idx));

  const distanceMatrix: number[][] = [];
  const nextMatrix: (string | null)[][] = [];

  for (let i = 0; i < n; i++) {
    distanceMatrix[i] = [];
    nextMatrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        distanceMatrix[i][j] = 0;
        nextMatrix[i][j] = nodeIds[j];
      } else {
        distanceMatrix[i][j] = Infinity;
        nextMatrix[i][j] = null;
      }
    }
  }

  graph.edges.forEach((edge) => {
    const i = nodeIndexMap.get(edge.from)!;
    const j = nodeIndexMap.get(edge.to)!;
    if (edge.weight < distanceMatrix[i][j]) {
      distanceMatrix[i][j] = edge.weight;
      nextMatrix[i][j] = edge.to;
    }
  });

  const createHighlight = (
    k: number,
    i: number,
    j: number,
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

    if (k >= 0 && k < n) {
      const kNode = nodeIds[k];
      if (kNode !== sourceId && kNode !== targetId) {
        nodeStates[kNode] = 'settled';
      }
    }

    if (i >= 0 && i < n) {
      const iNode = nodeIds[i];
      if (iNode !== sourceId && iNode !== targetId && nodeStates[iNode] === 'default') {
        nodeStates[iNode] = 'visiting';
      }
    }

    if (j >= 0 && j < n) {
      const jNode = nodeIds[j];
      if (jNode !== sourceId && jNode !== targetId && nodeStates[jNode] === 'default') {
        nodeStates[jNode] = 'visited';
      }
    }

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

  const cloneMatrix = (m: number[][]): number[][] => m.map((row) => [...row]);

  const addFrame = (
    description: string,
    currentK: number,
    currentI: number,
    currentJ: number,
    updatedCell: { i: number; j: number } | null = null,
    inPath?: { nodes: string[]; edges: string[] }
  ) => {
    const data: FloydWarshallFrameData = {
      distanceMatrix: cloneMatrix(distanceMatrix),
      nodeLabels: [...nodeIds],
      currentK,
      currentI,
      currentJ,
      updatedCell,
    };

    frames.push({
      index: frameIndex++,
      description,
      highlight: createHighlight(currentK, currentI, currentJ, inPath),
      data,
    });
  };

  addFrame(
    `初始化距离矩阵：对角线为 0，有直连边的填入权重，其余为 ∞。使用 ${n} 个节点`,
    -1,
    -1,
    -1
  );

  for (let k = 0; k < n; k++) {
    addFrame(
      `开始第 ${k + 1} 轮：以节点 ${nodeIds[k]} 作为中间节点，检查是否能缩短 i → k → j 的路径`,
      k,
      -1,
      -1
    );

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (distanceMatrix[i][k] === Infinity || distanceMatrix[k][j] === Infinity) {
          continue;
        }

        const throughK = distanceMatrix[i][k] + distanceMatrix[k][j];

        addFrame(
          `检查 dist[${nodeIds[i]}][${nodeIds[j]}]：当前=${distanceMatrix[i][j] === Infinity ? '∞' : distanceMatrix[i][j]}，经 ${nodeIds[k]} 中转=${distanceMatrix[i][k]} + ${distanceMatrix[k][j]} = ${throughK}`,
          k,
          i,
          j
        );

        if (throughK < distanceMatrix[i][j]) {
          distanceMatrix[i][j] = throughK;
          nextMatrix[i][j] = nextMatrix[i][k];

          addFrame(
            `更新！dist[${nodeIds[i]}][${nodeIds[j]}] = ${throughK}（经 ${nodeIds[k]} 中转更短）`,
            k,
            i,
            j,
            { i, j }
          );
        }
      }
    }

    addFrame(
      `第 ${k + 1} 轮完成：所有经过 ${nodeIds[k]} 的路径已优化`,
      k,
      -1,
      -1
    );
  }

  addFrame(`Floyd-Warshall 算法完成，已计算所有节点对的最短路径`, n - 1, -1, -1);

  const allPaths: { from: string; to: string; distance: number; path: string[] }[] = [];

  const getPath = (fromIdx: number, toIdx: number): string[] | null => {
    if (nextMatrix[fromIdx][toIdx] === null) return null;
    const path: string[] = [nodeIds[fromIdx]];
    let current = fromIdx;
    while (current !== toIdx) {
      const nextNode = nextMatrix[current][toIdx];
      if (nextNode === null) return null;
      current = nodeIndexMap.get(nextNode)!;
      path.push(nodeIds[current]);
    }
    return path;
  };

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && distanceMatrix[i][j] !== Infinity) {
        const path = getPath(i, j);
        if (path) {
          allPaths.push({
            from: nodeIds[i],
            to: nodeIds[j],
            distance: distanceMatrix[i][j],
            path,
          });
        }
      }
    }
  }

  let path: string[] = [];
  let pathEdges: string[] = [];
  if (sourceId && targetId) {
    const si = nodeIndexMap.get(sourceId)!;
    const ti = nodeIndexMap.get(targetId)!;
    if (distanceMatrix[si][ti] !== Infinity) {
      const foundPath = getPath(si, ti);
      if (foundPath) {
        path = foundPath;
        for (let idx = 0; idx < path.length - 1; idx++) {
          const edge = graph.edges.find((e) => e.from === path[idx] && e.to === path[idx + 1]);
          if (edge) {
            pathEdges.push(edge.id);
          }
        }
        addFrame(
          `${sourceId} → ${targetId} 最短路径：${path.join(' → ')}，距离：${distanceMatrix[si][ti]}`,
          n - 1,
          si,
          ti,
          null,
          { nodes: path, edges: pathEdges }
        );
      }
    } else {
      addFrame(`${sourceId} 无法到达 ${targetId}`, n - 1, si, ti);
    }
  }

  return {
    frames,
    summary: {
      type: 'floyd-warshall',
      value: sourceId && targetId
        ? distanceMatrix[nodeIndexMap.get(sourceId)!][nodeIndexMap.get(targetId)!]
        : undefined,
      path: path.length > 0 ? path : undefined,
      paths: allPaths,
    },
  };
}
