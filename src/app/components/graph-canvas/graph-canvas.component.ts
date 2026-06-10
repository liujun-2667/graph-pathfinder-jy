import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  HostListener,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  GraphData,
  GraphNode,
  GraphEdge,
  FrameHighlight,
  NodeColorState,
  EdgeColorState,
} from '../../models/graph';

interface ContextMenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface EdgeLayout {
  id: string;
  from: GraphNode;
  to: GraphNode;
  offset: number;
  hasReverse: boolean;
  path: string;
  labelX: number;
  labelY: number;
}

@Component({
  selector: 'app-graph-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './graph-canvas.component.html',
  styleUrl: './graph-canvas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraphCanvasComponent {
  @Input() graph: GraphData = { nodes: [], edges: [] };
  @Input() highlight: FrameHighlight | null = null;

  @Output() graphChange = new EventEmitter<GraphData>();
  @Output() nodeMoved = new EventEmitter<{ id: string; x: number; y: number }>();
  @Output() requestCreateNode = new EventEmitter<{ x: number; y: number }>();
  @Output() requestCreateEdge = new EventEmitter<{
    from: string;
    to: string;
    weight: number;
    capacity?: number;
    cost?: number;
  }>();
  @Output() requestDeleteNode = new EventEmitter<string>();
  @Output() requestDeleteEdge = new EventEmitter<string>();
  @Output() requestEditEdge = new EventEmitter<{
    id: string;
    weight: number;
    capacity?: number;
    cost?: number;
  }>();
  @Output() requestMarkNode = new EventEmitter<{
    id: string;
    markType: 'source' | 'target' | 'none';
  }>();

  @ViewChild('svgContainer') svgContainer!: ElementRef<SVGSVGElement>;
  @ViewChild('canvasGroup') canvasGroup!: ElementRef<SVGGElement>;

  viewTransform = { x: 0, y: 0, scale: 1 };

  isPanning = false;
  panStart = { x: 0, y: 0, tx: 0, ty: 0 };

  draggingNode: GraphNode | null = null;
  dragOffset = { x: 0, y: 0 };

  isCreatingEdge = false;
  edgeStartNode: GraphNode | null = null;
  edgeEndPos = { x: 0, y: 0 };
  edgeHoverNode: GraphNode | null = null;

  contextMenu: {
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null = null;

  readonly NODE_RADIUS = 28;

  constructor(private cdr: ChangeDetectorRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.contextMenu) {
      this.contextMenu = null;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.contextMenu = null;
    this.cancelEdgeCreation();
    this.cdr.markForCheck();
  }

  getSvgPoint(clientX: number, clientY: number): { x: number; y: number } {
    const svg = this.svgContainer.nativeElement;
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left - this.viewTransform.x) / this.viewTransform.scale;
    const y = (clientY - rect.top - this.viewTransform.y) / this.viewTransform.scale;
    return { x, y };
  }

  onSvgMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    if ((event.target as Element).closest('.node, .edge, .edge-label, .context-menu')) return;

    this.isPanning = true;
    this.panStart = {
      x: event.clientX,
      y: event.clientY,
      tx: this.viewTransform.x,
      ty: this.viewTransform.y,
    };
  }

  onSvgMouseMove(event: MouseEvent): void {
    if (this.isPanning) {
      this.viewTransform.x = this.panStart.tx + (event.clientX - this.panStart.x);
      this.viewTransform.y = this.panStart.ty + (event.clientY - this.panStart.y);
      this.cdr.markForCheck();
    }

    if (this.draggingNode) {
      const point = this.getSvgPoint(event.clientX, event.clientY);
      this.draggingNode.x = point.x - this.dragOffset.x;
      this.draggingNode.y = point.y - this.dragOffset.y;
      this.cdr.markForCheck();
    }

    if (this.isCreatingEdge) {
      const point = this.getSvgPoint(event.clientX, event.clientY);
      this.edgeEndPos = point;
      this.edgeHoverNode = this.findNodeAt(point.x, point.y);
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:mouseup', ['$event'])
  onSvgMouseUp(event: MouseEvent): void {
    if (this.isPanning) {
      this.isPanning = false;
    }

    if (this.draggingNode) {
      this.nodeMoved.emit({
        id: this.draggingNode.id,
        x: this.draggingNode.x,
        y: this.draggingNode.y,
      });
      this.draggingNode = null;
    }

    if (this.isCreatingEdge) {
      if (this.edgeHoverNode && this.edgeStartNode && this.edgeHoverNode.id !== this.edgeStartNode.id) {
        this.promptEdgeInfo(this.edgeStartNode.id, this.edgeHoverNode.id);
      }
      this.cancelEdgeCreation();
    }
  }

  onSvgWheel(event: WheelEvent): void {
    event.preventDefault();
    const svg = this.svgContainer.nativeElement;
    const rect = svg.getBoundingClientRect();

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.2, Math.min(5, this.viewTransform.scale * delta));

    this.viewTransform.x = mouseX - ((mouseX - this.viewTransform.x) * newScale) / this.viewTransform.scale;
    this.viewTransform.y = mouseY - ((mouseY - this.viewTransform.y) * newScale) / this.viewTransform.scale;
    this.viewTransform.scale = newScale;

    this.cdr.markForCheck();
  }

  onSvgDoubleClick(event: MouseEvent): void {
    if ((event.target as Element).closest('.node, .edge')) return;
    const point = this.getSvgPoint(event.clientX, event.clientY);
    this.requestCreateNode.emit({ x: point.x, y: point.y });
  }

  onNodeMouseDown(node: GraphNode, event: MouseEvent): void {
    event.stopPropagation();
    if (event.button !== 0) return;

    const point = this.getSvgPoint(event.clientX, event.clientY);
    this.dragOffset = { x: point.x - node.x, y: point.y - node.y };
    this.draggingNode = node;
  }

  onNodeMouseUp(node: GraphNode, event: MouseEvent): void {
    event.stopPropagation();
  }

  onNodeMouseEnter(node: GraphNode, event: MouseEvent): void {
    if (this.isCreatingEdge) {
      this.edgeHoverNode = node;
      this.cdr.markForCheck();
    }
  }

  onNodeMouseLeave(node: GraphNode, event: MouseEvent): void {
    if (this.isCreatingEdge && this.edgeHoverNode?.id === node.id) {
      this.edgeHoverNode = null;
      this.cdr.markForCheck();
    }
  }

  onEdgeStartMouseDown(node: GraphNode, event: MouseEvent): void {
    event.stopPropagation();
    if (event.button !== 0) return;
    this.isCreatingEdge = true;
    this.edgeStartNode = node;
    const point = this.getSvgPoint(event.clientX, event.clientY);
    this.edgeEndPos = point;
    this.edgeHoverNode = null;
  }

  cancelEdgeCreation(): void {
    this.isCreatingEdge = false;
    this.edgeStartNode = null;
    this.edgeHoverNode = null;
    this.cdr.markForCheck();
  }

  findNodeAt(x: number, y: number): GraphNode | null {
    for (const node of this.graph.nodes) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy <= this.NODE_RADIUS * this.NODE_RADIUS) {
        return node;
      }
    }
    return null;
  }

  promptEdgeInfo(from: string, to: string): void {
    const existingEdge = this.graph.edges.find((e) => e.from === from && e.to === to);
    if (existingEdge) {
      const weightStr = prompt('该边已存在，修改权重（正整数）：', String(existingEdge.weight));
      if (weightStr === null) return;
      const weight = parseInt(weightStr, 10);
      if (!isNaN(weight) && weight > 0) {
        const capacityStr = prompt('输入容量（可选，正整数，网络流使用）：', existingEdge.capacity ? String(existingEdge.capacity) : '');
        const capacity = capacityStr && capacityStr.trim() !== '' ? parseInt(capacityStr, 10) : undefined;
        if (!capacity || (capacity > 0)) {
          this.requestEditEdge.emit({ id: existingEdge.id, weight, capacity });
        }
      }
      return;
    }

    const weightStr = prompt('请输入边的权重（正整数）：', '1');
    if (weightStr === null) return;
    const weight = parseInt(weightStr, 10);
    if (!isNaN(weight) && weight > 0) {
      const capacityStr = prompt('输入容量（可选，正整数，网络流使用）：', '');
      const capacity = capacityStr && capacityStr.trim() !== '' ? parseInt(capacityStr, 10) : undefined;
      if (!capacity || capacity > 0) {
        this.requestCreateEdge.emit({ from, to, weight, capacity });
      }
    }
  }

  onNodeContextMenu(node: GraphNode, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.contextMenu = {
      x: event.clientX,
      y: event.clientY,
      items: [
        { label: '设为起点（绿色）', action: () => this.requestMarkNode.emit({ id: node.id, markType: 'source' }) },
        { label: '设为终点（红色）', action: () => this.requestMarkNode.emit({ id: node.id, markType: 'target' }) },
        { label: '取消标记', action: () => this.requestMarkNode.emit({ id: node.id, markType: 'none' }) },
        { label: '', action: () => {}, divider: true },
        { label: '删除节点', action: () => this.requestDeleteNode.emit(node.id), danger: true },
      ],
    };
    this.cdr.markForCheck();
  }

  onEdgeContextMenu(edge: GraphEdge, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.contextMenu = {
      x: event.clientX,
      y: event.clientY,
      items: [
        {
          label: '编辑权重/容量/费用',
          action: () => {
            const weightStr = prompt('修改权重（正整数）：', String(edge.weight));
            if (weightStr === null) return;
            const weight = parseInt(weightStr, 10);
            if (!isNaN(weight) && weight > 0) {
              const capacityStr = prompt('修改容量（可选，正整数）：', edge.capacity ? String(edge.capacity) : '');
              const capacity = capacityStr && capacityStr.trim() !== '' ? parseInt(capacityStr, 10) : undefined;
              const costStr = prompt('修改单位费用（可选，整数）：', edge.cost !== undefined ? String(edge.cost) : '');
              const cost = costStr && costStr.trim() !== '' ? parseInt(costStr, 10) : undefined;
              if ((!capacity || capacity > 0) && cost !== undefined ? !isNaN(cost) : true) {
                this.requestEditEdge.emit({ id: edge.id, weight, capacity, cost });
              }
            }
          },
        },
        { label: '', action: () => {}, divider: true },
        { label: '删除边', action: () => this.requestDeleteEdge.emit(edge.id), danger: true },
      ],
    };
    this.cdr.markForCheck();
  }

  closeContextMenu(): void {
    this.contextMenu = null;
  }

  getNodeState(nodeId: string): NodeColorState {
    if (this.highlight?.nodeStates[nodeId]) {
      return this.highlight.nodeStates[nodeId];
    }
    const node = this.graph.nodes.find((n) => n.id === nodeId);
    if (node?.isSource) return 'source';
    if (node?.isTarget) return 'target';
    return 'default';
  }

  getEdgeState(edgeId: string): EdgeColorState {
    return this.highlight?.edgeStates[edgeId] ?? 'default';
  }

  getNodeClass(nodeId: string): string {
    const state = this.getNodeState(nodeId);
    return `node-state-${state}`;
  }

  getEdgeClass(edgeId: string): string {
    const state = this.getEdgeState(edgeId);
    return `edge-state-${state}`;
  }

  getEdgeLayouts(): EdgeLayout[] {
    const layouts: EdgeLayout[] = [];
    const edgePairs = new Map<string, GraphEdge[]>();

    for (const edge of this.graph.edges) {
      const key = [edge.from, edge.to].sort().join('|');
      if (!edgePairs.has(key)) {
        edgePairs.set(key, []);
      }
      edgePairs.get(key)!.push(edge);
    }

    for (const [key, edges] of edgePairs) {
      const hasReverse = edges.some((e) => e.to === edges[0].from);
      const nodeMap = new Map(this.graph.nodes.map((n) => [n.id, n]));

      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) continue;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const perpX = -dy / dist;
        const perpY = dx / dist;

        let offset = 0;
        if (edges.length > 1) {
          const spacing = 18;
          offset = (i - (edges.length - 1) / 2) * spacing;
        } else if (hasReverse) {
          offset = 10;
        }

        const midX = (from.x + to.x) / 2 + perpX * offset;
        const midY = (from.y + to.y) / 2 + perpY * offset;

        const startX = from.x + (dx / dist) * this.NODE_RADIUS;
        const startY = from.y + (dy / dist) * this.NODE_RADIUS;
        const endX = to.x - (dx / dist) * this.NODE_RADIUS;
        const endY = to.y - (dy / dist) * this.NODE_RADIUS;

        const cp1x = startX + (midX - startX) * 0.6;
        const cp1y = startY + (midY - startY) * 0.6;
        const cp2x = endX + (midX - endX) * 0.6;
        const cp2y = endY + (midY - endY) * 0.6;

        const path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

        const labelX = midX;
        const labelY = midY;

        layouts.push({
          id: edge.id,
          from,
          to,
          offset,
          hasReverse,
          path,
          labelX,
          labelY,
        });
      }
    }

    return layouts;
  }

  getEdgeLabel(edge: GraphEdge): string {
    if (edge.capacity !== undefined && edge.capacity !== null && edge.cost !== undefined) {
      return `${edge.weight}/${edge.capacity}@${edge.cost}`;
    }
    if (edge.capacity !== undefined && edge.capacity !== null) {
      return `${edge.weight}/${edge.capacity}`;
    }
    if (edge.cost !== undefined) {
      return `${edge.weight}@${edge.cost}`;
    }
    return String(edge.weight);
  }

  getEdgeByLayoutId(layoutId: string): GraphEdge | undefined {
    return this.graph.edges.find((e) => e.id === layoutId);
  }

  getTransformString(): string {
    return `translate(${this.viewTransform.x}, ${this.viewTransform.y}) scale(${this.viewTransform.scale})`;
  }
}
