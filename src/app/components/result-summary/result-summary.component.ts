import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlgorithmResult, GraphData } from '../../models/graph';

type SummaryType = AlgorithmResult['summary'] | null;

@Component({
  selector: 'app-result-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './result-summary.component.html',
  styleUrl: './result-summary.component.scss'
})
export class ResultSummaryComponent {
  @Input() result: SummaryType = null;
  @Input() graph: GraphData = { nodes: [], edges: [] };

  isShortestPath(s: SummaryType): boolean {
    return s?.type === 'dijkstra' || s?.type === 'bellman-ford';
  }

  isAllPairsPath(s: SummaryType): boolean {
    return s?.type === 'floyd-warshall';
  }

  isMaxFlow(s: SummaryType): boolean {
    return s?.type === 'edmonds-karp';
  }

  isMinCostFlow(s: SummaryType): boolean {
    return s?.type === 'min-cost-max-flow';
  }

  isNegativeCycle(s: SummaryType): boolean {
    return s?.type === 'bellman-ford' && s?.hasNegativeCycle !== undefined;
  }

  getNodeLabel(nodeId: string): string {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    return node?.label || nodeId;
  }

  formatPath(nodeIds: string[]): string {
    return nodeIds.map(id => this.getNodeLabel(id)).join(' → ');
  }

  formatNodeList(nodeIds: string[]): string {
    return nodeIds.map(id => this.getNodeLabel(id)).join(', ');
  }
}
