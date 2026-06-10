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

  getDistanceEntries(data: DijkstraFrameData | BellmanFordFrameData): { node: string; dist: number }[] {
    return Object.entries(data.distances).map(([node, dist]) => ({ node, dist }));
  }

  formatNumber(n: number): string {
    if (!isFinite(n)) return '∞';
    return n.toString();
  }

  getEdgeLabel(edgeId: string): string {
    const edge = this.graph.edges.find(e => e.id === edgeId);
    if (!edge) return edgeId;
    return `${edge.from}→${edge.to}`;
  }

  isCellUpdated(data: FloydWarshallFrameData, i: number, j: number): boolean {
    return data.updatedCell?.i === i && data.updatedCell?.j === j;
  }

  isCurrentCell(data: FloydWarshallFrameData, i: number, j: number): boolean {
    return data.currentI === i && data.currentJ === j;
  }

  readonly INF = Infinity;
}
