import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GraphNode, GraphEdge, GraphData } from '../models/graph';

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface RandomGraphConfig {
  nodeCount: number;
  density: 'sparse' | 'medium' | 'dense';
  weightMin: number;
  weightMax: number;
  allowNegative?: boolean;
  forNetworkFlow?: boolean;
}

@Injectable({ providedIn: 'root' })
export class GraphService {
  private readonly graphSubject = new BehaviorSubject<GraphState>({ nodes: [], edges: [] });
  private readonly sourceIdSubject = new BehaviorSubject<string | null>(null);
  private readonly targetIdSubject = new BehaviorSubject<string | null>(null);

  readonly graph$ = this.graphSubject.asObservable();
  readonly sourceId$ = this.sourceIdSubject.asObservable();
  readonly targetId$ = this.targetIdSubject.asObservable();

  private get nodes(): GraphNode[] {
    return this.graphSubject.value.nodes;
  }

  private get edges(): GraphEdge[] {
    return this.graphSubject.value.edges;
  }

  addNode(x: number, y: number): GraphNode {
    const label = this.getNextLabel();
    const node: GraphNode = {
      id: this.generateId('node'),
      label,
      x,
      y,
    };
    const newNodes = [...this.nodes, node];
    this.graphSubject.next({ nodes: newNodes, edges: this.edges });
    return node;
  }

  moveNode(id: string, x: number, y: number): void {
    const newNodes = this.nodes.map(n =>
      n.id === id ? { ...n, x, y } : n
    );
    this.graphSubject.next({ nodes: newNodes, edges: this.edges });
  }

  deleteNode(id: string): void {
    const newNodes = this.nodes.filter(n => n.id !== id);
    const newEdges = this.edges.filter(e => e.from !== id && e.to !== id);
    this.graphSubject.next({ nodes: newNodes, edges: newEdges });

    if (this.sourceIdSubject.value === id) {
      this.sourceIdSubject.next(null);
    }
    if (this.targetIdSubject.value === id) {
      this.targetIdSubject.next(null);
    }
  }

  addEdge(
    from: string,
    to: string,
    weight: number,
    capacity?: number,
    cost?: number
  ): GraphEdge {
    const edge: GraphEdge = {
      id: this.generateId('edge'),
      from,
      to,
      weight,
      capacity,
      cost,
    };
    const newEdges = [...this.edges, edge];
    this.graphSubject.next({ nodes: this.nodes, edges: newEdges });
    return edge;
  }

  updateEdge(
    id: string,
    weight: number,
    capacity?: number,
    cost?: number
  ): void {
    const newEdges = this.edges.map(e =>
      e.id === id ? { ...e, weight, capacity, cost } : e
    );
    this.graphSubject.next({ nodes: this.nodes, edges: newEdges });
  }

  deleteEdge(id: string): void {
    const newEdges = this.edges.filter(e => e.id !== id);
    this.graphSubject.next({ nodes: this.nodes, edges: newEdges });
  }

  setSource(id: string | null): void {
    const newNodes = this.nodes.map(n => ({
      ...n,
      isSource: n.id === id ? true : false,
    }));
    this.graphSubject.next({ nodes: newNodes, edges: this.edges });
    this.sourceIdSubject.next(id);
  }

  setTarget(id: string | null): void {
    const newNodes = this.nodes.map(n => ({
      ...n,
      isTarget: n.id === id ? true : false,
    }));
    this.graphSubject.next({ nodes: newNodes, edges: this.edges });
    this.targetIdSubject.next(id);
  }

  clearMarks(): void {
    const newNodes = this.nodes.map(n => ({
      ...n,
      isSource: false,
      isTarget: false,
    }));
    this.graphSubject.next({ nodes: newNodes, edges: this.edges });
    this.sourceIdSubject.next(null);
    this.targetIdSubject.next(null);
  }

  clearGraph(): void {
    this.graphSubject.next({ nodes: [], edges: [] });
    this.sourceIdSubject.next(null);
    this.targetIdSubject.next(null);
  }

  loadGraph(graphData: GraphData): void {
    const sourceNode = graphData.nodes.find(n => n.isSource);
    const targetNode = graphData.nodes.find(n => n.isTarget);
    this.graphSubject.next({
      nodes: [...graphData.nodes],
      edges: [...graphData.edges],
    });
    this.sourceIdSubject.next(sourceNode ? sourceNode.id : null);
    this.targetIdSubject.next(targetNode ? targetNode.id : null);
  }

  getNextLabel(): string {
    const usedLabels = new Set(this.nodes.map(n => n.label));
    let num = 0;
    while (true) {
      const label = this.numberToLabel(num);
      if (!usedLabels.has(label)) {
        return label;
      }
      num++;
    }
  }

  private numberToLabel(num: number): string {
    let result = '';
    let n = num;
    while (true) {
      result = String.fromCharCode(65 + (n % 26)) + result;
      n = Math.floor(n / 26) - 1;
      if (n < 0) break;
    }
    return result;
  }

  generateRandomGraph(config: RandomGraphConfig): GraphData {
    const {
      nodeCount,
      density,
      weightMin,
      weightMax,
      allowNegative = false,
      forNetworkFlow = false,
    } = config;

    const count = Math.max(5, Math.min(20, nodeCount));
    const nodes: GraphNode[] = [];

    const centerX = 400;
    const centerY = 300;
    const radius = 220;

    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      const jitter = 0.85 + Math.random() * 0.3;
      nodes.push({
        id: this.generateId('node'),
        label: this.numberToLabel(i),
        x: centerX + radius * jitter * Math.cos(angle),
        y: centerY + radius * jitter * Math.sin(angle),
      });
    }

    nodes[0].isSource = true;
    nodes[count - 1].isTarget = true;

    const edges: GraphEdge[] = [];
    const existingEdges = new Set<string>();

    let edgeProbability: number;
    switch (density) {
      case 'sparse':
        edgeProbability = 0.15;
        break;
      case 'medium':
        edgeProbability = 0.35;
        break;
      case 'dense':
        edgeProbability = 0.6;
        break;
    }

    const minEdgesPerNode = forNetworkFlow ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const possibleTargets: number[] = [];
      for (let j = 0; j < count; j++) {
        if (i !== j) {
          const key = forNetworkFlow ? `${i}-${j}` : `${Math.min(i, j)}-${Math.max(i, j)}`;
          if (!existingEdges.has(key)) {
            possibleTargets.push(j);
          }
        }
      }
      const connectedCount = possibleTargets.filter(j => {
        const key = forNetworkFlow ? `${j}-${i}` : `${Math.min(i, j)}-${Math.max(i, j)}`;
        return existingEdges.has(key);
      }).length;

      const needMore = minEdgesPerNode - connectedCount;
      if (needMore > 0 && possibleTargets.length > 0) {
        for (let k = 0; k < needMore && possibleTargets.length > 0; k++) {
          const idx = Math.floor(Math.random() * possibleTargets.length);
          const j = possibleTargets.splice(idx, 1)[0];
          this.addRandomEdge(nodes, edges, existingEdges, i, j, weightMin, weightMax, allowNegative, forNetworkFlow);
        }
      }
    }

    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        if (Math.random() < edgeProbability) {
          const key = forNetworkFlow ? `${i}-${j}` : `${i}-${j}`;
          if (!existingEdges.has(key)) {
            this.addRandomEdge(nodes, edges, existingEdges, i, j, weightMin, weightMax, allowNegative, forNetworkFlow);
          }
          if (forNetworkFlow && Math.random() < edgeProbability * 0.5) {
            const reverseKey = `${j}-${i}`;
            if (!existingEdges.has(reverseKey)) {
              this.addRandomEdge(nodes, edges, existingEdges, j, i, weightMin, weightMax, allowNegative, forNetworkFlow);
            }
          }
        }
      }
    }

    return { nodes, edges };
  }

  private addRandomEdge(
    nodes: GraphNode[],
    edges: GraphEdge[],
    existingEdges: Set<string>,
    fromIdx: number,
    toIdx: number,
    weightMin: number,
    weightMax: number,
    allowNegative: boolean,
    forNetworkFlow: boolean
  ): void {
    const key = forNetworkFlow ? `${fromIdx}-${toIdx}` : `${Math.min(fromIdx, toIdx)}-${Math.max(fromIdx, toIdx)}`;
    if (existingEdges.has(key)) return;

    let weight: number;
    if (allowNegative) {
      weight = weightMin + Math.floor(Math.random() * (weightMax - weightMin + 1));
    } else {
      const actualMin = Math.max(1, weightMin);
      weight = actualMin + Math.floor(Math.random() * (weightMax - actualMin + 1));
    }

    const edge: GraphEdge = {
      id: this.generateId('edge'),
      from: nodes[fromIdx].id,
      to: nodes[toIdx].id,
      weight,
    };

    if (forNetworkFlow) {
      edge.capacity = 5 + Math.floor(Math.random() * 20);
      edge.cost = 1 + Math.floor(Math.random() * 10);
    }

    edges.push(edge);
    existingEdges.add(key);
  }

  toJson(): string {
    const data: GraphData & { sourceId: string | null; targetId: string | null } = {
      nodes: this.nodes,
      edges: this.edges,
      sourceId: this.sourceIdSubject.value,
      targetId: this.targetIdSubject.value,
    };
    return JSON.stringify(data, null, 2);
  }

  fromJson(json: string): void {
    const data = JSON.parse(json) as GraphData & { sourceId?: string | null; targetId?: string | null };
    this.loadGraph({ nodes: data.nodes, edges: data.edges });
    if (data.sourceId) {
      this.setSource(data.sourceId);
    }
    if (data.targetId) {
      this.setTarget(data.targetId);
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
