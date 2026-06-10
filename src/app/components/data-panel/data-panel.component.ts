import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlgorithmType,
  AlgorithmFrameData,
  GraphData,
  DijkstraFrameData,
  BellmanFordFrameData,
  FloydWarshallFrameData,
  EdmondsKarpFrameData,
  MinCostFlowFrameData
} from '../../models/graph';

@Component({
  selector: 'app-data-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-panel.component.html',
  styleUrl: './data-panel.component.scss'
})
export class DataPanelComponent {
  @Input() algorithmType: AlgorithmType | null = null;
  @Input() frameData: AlgorithmFrameData | null = null;
  @Input() graph: GraphData = { nodes: [], edges: [] };

  isDijkstraData(data: AlgorithmFrameData | null): data is DijkstraFrameData {
    return this.algorithmType === 'dijkstra' && data !== null && 'priorityQueue' in data;
  }

  isBellmanFordData(data: AlgorithmFrameData | null): data is BellmanFordFrameData {
    return this.algorithmType === 'bellman-ford' && data !== null && 'currentIteration' in data;
  }

  isFloydWarshallData(data: AlgorithmFrameData | null): data is FloydWarshallFrameData {
    return this.algorithmType === 'floyd-warshall' && data !== null && 'distanceMatrix' in data;
  }

  isEdmondsKarpData(data: AlgorithmFrameData | null): data is EdmondsKarpFrameData {
    return this.algorithmType === 'edmonds-karp' && data !== null && 'residualCapacity' in data && !('potential' in data);
  }

  isMinCostFlowData(data: AlgorithmFrameData | null): data is MinCostFlowFrameData {
    return this.algorithmType === 'min-cost-max-flow' && data !== null && 'potential' in data;
  }

  getDistanceEntries(data: DijkstraFrameData | BellmanFordFrameData): { node: string; nodeLabel: string; dist: number }[] {
    return Object.entries(data.distances).map(([node, dist]) => ({
      node,
      nodeLabel: this.getNodeLabel(node),
      dist,
    }));
  }

  formatNumber(n: number): string {
    if (!isFinite(n)) return '∞';
    return n.toString();
  }

  getNodeLabel(nodeId: string): string {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    return node?.label || nodeId;
  }

  formatNodeList(nodeIds: string[]): string {
    return nodeIds.map(id => this.getNodeLabel(id)).join(' → ');
  }

  formatNodeListComma(nodeIds: string[]): string {
    return nodeIds.map(id => this.getNodeLabel(id)).join(', ');
  }

  getEdgeLabel(edgeId: string): string {
    const edge = this.graph.edges.find(e => e.id === edgeId);
    if (!edge) return edgeId;
    return `${this.getNodeLabel(edge.from)}→${this.getNodeLabel(edge.to)}`;
  }

  isCellUpdated(data: FloydWarshallFrameData, i: number, j: number): boolean {
    return data.updatedCell?.i === i && data.updatedCell?.j === j;
  }

  isCurrentCell(data: FloydWarshallFrameData, i: number, j: number): boolean {
    return data.currentI === i && data.currentJ === j;
  }

  getFloydNodeLabels(data: FloydWarshallFrameData): string[] {
    return data.nodeLabels.map(id => this.getNodeLabel(id));
  }

  readonly INF = Infinity;
}
