import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlgorithmType, AlgorithmInfo } from '../../models/graph';

const ALGORITHM_INFO_MAP: Record<AlgorithmType, AlgorithmInfo> = {
  'dijkstra': {
    name: 'Dijkstra 算法',
    type: 'dijkstra',
    description: 'Dijkstra 算法是一种求解单源最短路径的经典算法，适用于非负权图。它通过贪心策略，每次选择距离源点最近且未确定的节点进行松弛操作，时间复杂度为 O((V+E)logV)。',
    pseudocode: `function Dijkstra(Graph, source):
  dist[source] ← 0
  for each vertex v:
    if v ≠ source: dist[v] ← ∞
  PQ ← priority queue containing (0, source)
  while PQ not empty:
    (d, u) ← extract-min(PQ)
    if d > dist[u]: continue
    for each neighbor v of u:
      alt ← dist[u] + weight(u, v)
      if alt < dist[v]:
        dist[v] ← alt
        prev[v] ← u
        add (alt, v) to PQ
  return dist, prev`,
    category: 'shortest-path'
  },
  'bellman-ford': {
    name: 'Bellman-Ford 算法',
    type: 'bellman-ford',
    description: 'Bellman-Ford 算法可处理含负权边的单源最短路径问题，并能检测负环。它对所有边进行 V-1 轮松弛操作，若第 V 轮仍能松弛则存在负环，时间复杂度为 O(VE)。',
    pseudocode: `function BellmanFord(Graph, source):
  dist[source] ← 0
  for each vertex v:
    if v ≠ source: dist[v] ← ∞
  for i from 1 to V-1:
    for each edge (u, v):
      if dist[u] + w(u,v) < dist[v]:
        dist[v] ← dist[u] + w(u,v)
        prev[v] ← u
  for each edge (u, v):
    if dist[u] + w(u,v) < dist[v]:
      error "负环存在"
  return dist, prev`,
    category: 'shortest-path'
  },
  'floyd-warshall': {
    name: 'Floyd-Warshall 算法',
    type: 'floyd-warshall',
    description: 'Floyd-Warshall 算法用于求解所有节点对之间的最短路径，支持负权边但不允许负环。它基于动态规划，通过三重循环逐步更新距离矩阵，时间复杂度为 O(V³)。',
    pseudocode: `function FloydWarshall(Graph):
  dist ← |V|×|V| matrix
  for i from 1 to V:
    dist[i][i] ← 0
  for each edge (u, v):
    dist[u][v] ← w(u, v)
  for k from 1 to V:
    for i from 1 to V:
      for j from 1 to V:
        if dist[i][j] > dist[i][k] + dist[k][j]:
          dist[i][j] ← dist[i][k] + dist[k][j]
  return dist`,
    category: 'shortest-path'
  },
  'edmonds-karp': {
    name: 'Edmonds-Karp 算法',
    type: 'edmonds-karp',
    description: 'Edmonds-Karp 算法是 Ford-Fulkerson 方法的 BFS 实现，用于求解网络最大流问题。它每次通过 BFS 寻找增广路径并更新残余网络，时间复杂度为 O(VE²)。',
    pseudocode: `function EdmondsKarp(Graph, s, t):
  maxFlow ← 0
  while BFS finds path s→t:
    pathFlow ← min residual capacity on path
    maxFlow ← maxFlow + pathFlow
    for each edge (u,v) on path:
      residual[u][v] ← residual[u][v] - pathFlow
      residual[v][u] ← residual[v][u] + pathFlow
  return maxFlow`,
    category: 'network-flow'
  },
  'min-cost-max-flow': {
    name: '最小费用最大流',
    type: 'min-cost-max-flow',
    description: '最小费用最大流算法在保证最大流的同时使总费用最小。通常结合 SPFA 或势能优化的 Dijkstra 在残余网络中寻找最小费用增广路径，逐步增广至最大流。',
    pseudocode: `function MinCostMaxFlow(Graph, s, t):
  flow ← 0, cost ← 0
  while true:
    dist ← SPFA on residual graph from s
    if dist[t] = ∞: break
    f ← ∞
    for v from t downto s via prev:
      f ← min(f, residual[prev[v]][v])
    flow ← flow + f
    cost ← cost + f × dist[t]
    for v from t downto s via prev:
      update residual and reverse edges
  return flow, cost`,
    category: 'network-flow'
  },
  'custom': {
    name: '自定义算法',
    type: 'custom',
    description: '用户自定义的图算法脚本。使用 JavaScript 编写，通过帧动画方式展示算法执行过程。可通过下方脚本编辑器编写、运行和保存自定义算法。',
    pseudocode: `function myAlgorithm(graph, sourceId, targetId) {
  const frames = [];
  // 初始化节点和边状态
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
    category: 'custom'
  }
};

@Component({
  selector: 'app-algorithm-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './algorithm-info.component.html',
  styleUrl: './algorithm-info.component.scss'
})
export class AlgorithmInfoComponent {
  @Input() algorithmType: AlgorithmType | null = null;

  get info(): AlgorithmInfo | null {
    if (!this.algorithmType) return null;
    return ALGORITHM_INFO_MAP[this.algorithmType];
  }
}
