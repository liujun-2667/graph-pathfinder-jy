import { GraphData, GraphNode, GraphEdge } from '../models/graph';

export interface PresetGraph {
  name: string;
  description: string;
  graph: GraphData;
}

const makeNode = (
  id: string,
  label: string,
  x: number,
  y: number,
  isSource = false,
  isTarget = false
): GraphNode => ({ id, label, x, y, isSource, isTarget });

const makeEdge = (
  id: string,
  from: string,
  to: string,
  weight: number,
  capacity?: number,
  cost?: number
): GraphEdge => ({ id, from, to, weight, capacity, cost });

const simpleShortestPath: GraphData = {
  nodes: [
    makeNode('n1', 'A', 150, 300, true),
    makeNode('n2', 'B', 350, 150),
    makeNode('n3', 'C', 350, 450),
    makeNode('n4', 'D', 600, 300, false, true),
  ],
  edges: [
    makeEdge('e1', 'n1', 'n2', 4),
    makeEdge('e2', 'n1', 'n3', 2),
    makeEdge('e3', 'n2', 'n4', 3),
    makeEdge('e4', 'n3', 'n4', 5),
    makeEdge('e5', 'n2', 'n3', 1),
  ],
};

const negativeWeightGraph: GraphData = {
  nodes: [
    makeNode('n1', 'S', 100, 300, true),
    makeNode('n2', 'A', 300, 120),
    makeNode('n3', 'B', 300, 300),
    makeNode('n4', 'C', 300, 480),
    makeNode('n5', 'T', 550, 300, false, true),
  ],
  edges: [
    makeEdge('e1', 'n1', 'n2', 7),
    makeEdge('e2', 'n1', 'n3', 4),
    makeEdge('e3', 'n2', 'n3', -2),
    makeEdge('e4', 'n3', 'n4', 3),
    makeEdge('e5', 'n2', 'n5', 1),
    makeEdge('e6', 'n4', 'n5', -3),
    makeEdge('e7', 'n3', 'n5', 6),
  ],
};

const negativeCycleGraph: GraphData = {
  nodes: [
    makeNode('n1', 'S', 100, 300, true),
    makeNode('n2', 'A', 300, 150),
    makeNode('n3', 'B', 500, 150),
    makeNode('n4', 'C', 400, 350),
    makeNode('n5', 'D', 250, 450),
    makeNode('n6', 'T', 650, 350, false, true),
  ],
  edges: [
    makeEdge('e1', 'n1', 'n2', 3),
    makeEdge('e2', 'n1', 'n5', 5),
    makeEdge('e3', 'n2', 'n3', 2),
    makeEdge('e4', 'n3', 'n4', -4),
    makeEdge('e5', 'n4', 'n2', 1),
    makeEdge('e6', 'n4', 'n6', 4),
    makeEdge('e7', 'n5', 'n4', 2),
    makeEdge('e8', 'n2', 'n5', -1),
  ],
};

const networkFlowGraph: GraphData = {
  nodes: [
    makeNode('n1', 'S', 100, 300, true),
    makeNode('n2', 'A', 300, 120),
    makeNode('n3', 'B', 300, 300),
    makeNode('n4', 'C', 300, 480),
    makeNode('n5', 'D', 500, 200),
    makeNode('n6', 'E', 500, 400),
    makeNode('n7', 'T', 700, 300, false, true),
  ],
  edges: [
    makeEdge('e1', 'n1', 'n2', 0, 10),
    makeEdge('e2', 'n1', 'n3', 0, 8),
    makeEdge('e3', 'n1', 'n4', 0, 5),
    makeEdge('e4', 'n2', 'n5', 0, 6),
    makeEdge('e5', 'n2', 'n3', 0, 4),
    makeEdge('e6', 'n3', 'n5', 0, 3),
    makeEdge('e7', 'n3', 'n6', 0, 7),
    makeEdge('e8', 'n4', 'n6', 0, 9),
    makeEdge('e9', 'n5', 'n7', 0, 12),
    makeEdge('e10', 'n6', 'n7', 0, 10),
    makeEdge('e11', 'n5', 'n6', 0, 2),
  ],
};

const minCostFlowGraph: GraphData = {
  nodes: [
    makeNode('n1', 'S', 100, 300, true),
    makeNode('n2', 'A', 300, 150),
    makeNode('n3', 'B', 300, 450),
    makeNode('n4', 'C', 500, 150),
    makeNode('n5', 'D', 500, 450),
    makeNode('n6', 'T', 700, 300, false, true),
  ],
  edges: [
    makeEdge('e1', 'n1', 'n2', 0, 8, 2),
    makeEdge('e2', 'n1', 'n3', 0, 10, 5),
    makeEdge('e3', 'n2', 'n3', 0, 4, 1),
    makeEdge('e4', 'n2', 'n4', 0, 6, 3),
    makeEdge('e5', 'n3', 'n5', 0, 9, 2),
    makeEdge('e6', 'n4', 'n5', 0, 3, 4),
    makeEdge('e7', 'n4', 'n6', 0, 7, 6),
    makeEdge('e8', 'n5', 'n6', 0, 12, 1),
    makeEdge('e9', 'n3', 'n4', 0, 2, 3),
  ],
};

export const PRESET_GRAPHS: PresetGraph[] = [
  {
    name: '简单4节点最短路径',
    description: '经典Dijkstra算法演示用例，包含4个节点和多条路径，可直观展示单源最短路径求解过程。',
    graph: simpleShortestPath,
  },
  {
    name: '含负权边图',
    description: 'Bellman-Ford算法演示用例，包含负权边但无负环，用于展示处理负权边的最短路径求解。',
    graph: negativeWeightGraph,
  },
  {
    name: '含负环图',
    description: '负环检测演示用例，图中存在可达的负权环，用于验证Bellman-Ford算法的负环检测能力。',
    graph: negativeCycleGraph,
  },
  {
    name: '标准网络流图',
    description: 'Edmonds-Karp算法演示用例，标准最大流网络，用于展示BFS寻找增广路求解最大流的过程。',
    graph: networkFlowGraph,
  },
  {
    name: '最小费用最大流',
    description: 'Min-Cost-Max-Flow算法演示用例，每条边同时具有容量和单位费用，用于展示在保证最大流前提下费用最小化。',
    graph: minCostFlowGraph,
  },
];
