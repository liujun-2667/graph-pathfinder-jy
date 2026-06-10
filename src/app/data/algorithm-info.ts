import { AlgorithmType, AlgorithmInfo } from '../models/graph';

export const ALGORITHM_INFO: Record<AlgorithmType, AlgorithmInfo> = {
  dijkstra: {
    name: 'Dijkstra 算法',
    type: 'dijkstra',
    category: 'shortest-path',
    description:
      '基于贪心策略的单源最短路径算法。使用优先队列每次选择当前距离最小的未访问节点，松弛其所有出边，逐步确定各节点到源点的最短距离。仅适用于非负权边图，时间复杂度 O((V+E) log V)。',
    pseudocode: `function Dijkstra(Graph, source):
  for each vertex v:
    dist[v] ← infinity
    prev[v] ← undefined
  dist[source] ← 0
  PQ ← priority queue containing (0, source)
  while PQ is not empty:
    u ← vertex with min dist from PQ
    if u is settled: continue
    mark u as settled
    for each edge u→v with weight w:
      alt ← dist[u] + w
      if alt < dist[v]:
        dist[v] ← alt
        prev[v] ← u
        add (alt, v) to PQ
  return dist, prev`,
  },
  'bellman-ford': {
    name: 'Bellman-Ford 算法',
    type: 'bellman-ford',
    category: 'shortest-path',
    description:
      '基于动态规划的单源最短路径算法，可处理负权边。对所有边进行 V-1 轮松弛操作，每轮扩展可达的最短路径。若第 V 轮仍可松弛，则存在负环。时间复杂度 O(V·E)，适合边数较少的稀疏图。',
    pseudocode: `function BellmanFord(Graph, source):
  for each vertex v:
    dist[v] ← infinity
    prev[v] ← undefined
  dist[source] ← 0
  for i from 1 to V-1:
    for each edge u→v with weight w:
      if dist[u] + w < dist[v]:
        dist[v] ← dist[u] + w
        prev[v] ← u
  for each edge u→v with weight w:
    if dist[u] + w < dist[v]:
      return "negative cycle detected"
  return dist, prev`,
  },
  'floyd-warshall': {
    name: 'Floyd-Warshall 算法',
    type: 'floyd-warshall',
    category: 'shortest-path',
    description:
      '基于动态规划的多源最短路径算法，求解任意两点间最短路径。使用距离矩阵，以每个节点作为中间节点k进行松弛更新。可处理负权边，时间复杂度 O(V³)，适合节点数较小的稠密图。',
    pseudocode: `function FloydWarshall(Graph):
  V ← number of vertices
  dist ← V×V matrix initialized to infinity
  for each vertex v:
    dist[v][v] ← 0
  for each edge u→v with weight w:
    dist[u][v] ← w
  for k from 0 to V-1:
    for i from 0 to V-1:
      for j from 0 to V-1:
        if dist[i][k] + dist[k][j] < dist[i][j]:
          dist[i][j] ← dist[i][k] + dist[k][j]
  return dist`,
  },
  'edmonds-karp': {
    name: 'Edmonds-Karp 算法',
    type: 'edmonds-karp',
    category: 'network-flow',
    description:
      'Ford-Fulkerson方法的BFS实现，用于求解网络最大流。在残量网络中反复用BFS寻找从源到汇的增广路径，取路径上最小残量作为瓶颈流量增广，直至无增广路径。时间复杂度 O(V·E²)。',
    pseudocode: `function EdmondsKarp(Graph, source, sink):
  maxFlow ← 0
  residual ← copy of capacities
  while true:
    parent ← BFS(residual, source, sink)
    if no path from source to sink: break
    pathFlow ← infinity
    v ← sink
    while v ≠ source:
      u ← parent[v]
      pathFlow ← min(pathFlow, residual[u][v])
      v ← u
    v ← sink
    while v ≠ source:
      u ← parent[v]
      residual[u][v] ← residual[u][v] - pathFlow
      residual[v][u] ← residual[v][u] + pathFlow
      v ← u
    maxFlow ← maxFlow + pathFlow
  return maxFlow`,
  },
  'min-cost-max-flow': {
    name: '最小费用最大流',
    type: 'min-cost-max-flow',
    category: 'network-flow',
    description:
      '在保证最大流的前提下求解最小费用。每次用SPFA在残量网络中寻找费用最短的增广路，沿该路增广流量。使用Johnson势函数避免负权，重复至无增广路。同时输出最大流量与最小总费用。',
    pseudocode: `function MinCostMaxFlow(Graph, source, sink):
  totalFlow ← 0, totalCost ← 0
  flow ← zero matrix, cost ← cost matrix
  residual ← capacity matrix
  potential ← 0 for all vertices
  while true:
    dist ← SPFA using reduced costs
    if dist[sink] = infinity: break
    pathFlow ← infinity
    v ← sink
    while v ≠ source:
      u ← parent[v]
      pathFlow ← min(pathFlow, residual[u][v] - flow[u][v])
      v ← u
    v ← sink
    while v ≠ source:
      u ← parent[v]
      flow[u][v] ← flow[u][v] + pathFlow
      flow[v][u] ← flow[v][u] - pathFlow
      totalCost ← totalCost + pathFlow * cost[u][v]
      v ← u
    totalFlow ← totalFlow + pathFlow
    for all v: potential[v] ← potential[v] + dist[v]
  return totalFlow, totalCost`,
  },
  custom: {
    name: '自定义算法',
    type: 'custom',
    category: 'custom',
    description:
      '用户自定义的图算法脚本。使用 JavaScript 编写，通过帧动画方式展示算法执行过程。可通过右侧脚本编辑器编写、运行和保存自定义算法。',
    pseudocode: `function myAlgorithm(graph, sourceId, targetId) {
  const frames = [];
  
  // 初始化节点和边的状态
  // graph.nodes - 节点数组 { id, label }
  // graph.edges - 边数组 { from, to, weight, capacity }
  
  // 添加动画帧
  frames.push({
    description: '步骤描述',
    highlight: {
      nodeStates: { 'nodeId': 'visiting' },
      edgeStates: { 'edgeId': 'relaxing' }
    },
    data: {
      // 自定义数据
    }
  });
  
  return frames;
}`,
  },
};
