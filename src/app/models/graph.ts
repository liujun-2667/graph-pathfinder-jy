export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  isSource?: boolean;
  isTarget?: boolean;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
  capacity?: number;
  cost?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type AlgorithmType =
  | 'dijkstra'
  | 'bellman-ford'
  | 'floyd-warshall'
  | 'edmonds-karp'
  | 'min-cost-max-flow'
  | 'custom';

export type NodeColorState =
  | 'default'
  | 'source'
  | 'target'
  | 'visiting'
  | 'visited'
  | 'settled'
  | 'in-path';

export type EdgeColorState =
  | 'default'
  | 'relaxing'
  | 'in-tree'
  | 'in-path'
  | 'augmenting'
  | 'residual'
  | 'saturated';

export interface FrameHighlight {
  nodeStates: Record<string, NodeColorState>;
  edgeStates: Record<string, EdgeColorState>;
}

export interface DijkstraFrameData {
  distances: Record<string, number>;
  previous: Record<string, string | null>;
  priorityQueue: { node: string; dist: number }[];
  currentNode?: string;
  relaxingEdge?: string;
  settledNodes: string[];
}

export interface BellmanFordFrameData {
  distances: Record<string, number>;
  previous: Record<string, string | null>;
  currentIteration: number;
  totalIterations: number;
  currentEdge?: string;
  relaxedInIteration: string[];
  hasNegativeCycle?: boolean;
  negativeCycleNodes?: string[];
}

export interface FloydWarshallFrameData {
  distanceMatrix: number[][];
  nodeLabels: string[];
  currentK: number;
  currentI: number;
  currentJ: number;
  updatedCell: { i: number; j: number } | null;
}

export interface EdmondsKarpFrameData {
  residualCapacity: Record<string, number>;
  flow: Record<string, number>;
  augmentingPath: string[];
  currentEdgeInBFS?: string;
  visitedInBFS: string[];
  maxFlowSoFar: number;
  minCutS?: string[];
  minCutT?: string[];
}

export interface MinCostFlowFrameData {
  residualCapacity: Record<string, number>;
  residualCost: Record<string, number>;
  flow: Record<string, number>;
  distances: Record<string, number>;
  potential: Record<string, number>;
  augmentingPath: string[];
  flowSoFar: number;
  costSoFar: number;
  currentEdgeInSPFA?: string;
}

export interface CustomFrameData {
  [key: string]: any;
}

export type AlgorithmFrameData =
  | DijkstraFrameData
  | BellmanFordFrameData
  | FloydWarshallFrameData
  | EdmondsKarpFrameData
  | MinCostFlowFrameData
  | CustomFrameData;

export interface AnimationFrame {
  index: number;
  description: string;
  highlight: FrameHighlight;
  data: AlgorithmFrameData;
}

export interface AlgorithmResult {
  frames: AnimationFrame[];
  summary: {
    type: string;
    value?: number;
    path?: string[];
    paths?: { from: string; to: string; distance: number; path: string[] }[];
    maxFlow?: number;
    minCut?: { S: string[]; T: string[] };
    totalFlow?: number;
    totalCost?: number;
    hasNegativeCycle?: boolean;
    negativeCycle?: string[];
  };
}

export interface AlgorithmInfo {
  name: string;
  type: AlgorithmType;
  description: string;
  pseudocode: string;
  category: 'shortest-path' | 'network-flow';
}
