import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, combineLatest, takeUntil } from 'rxjs';

import { GraphCanvasComponent } from './components/graph-canvas/graph-canvas.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { AnimationControlsComponent } from './components/animation-controls/animation-controls.component';
import { DataPanelComponent } from './components/data-panel/data-panel.component';
import { AlgorithmInfoComponent } from './components/algorithm-info/algorithm-info.component';
import { ResultSummaryComponent } from './components/result-summary/result-summary.component';
import { CustomScriptPanelComponent } from './components/custom-script-panel/custom-script-panel.component';
import { GraphService } from './services/graph.service';
import { AnimationService } from './services/animation.service';
import { HistoryService, HistoryRecord } from './services/history.service';
import { PRESET_GRAPHS } from './data/presets';
import { ALGORITHM_INFO } from './data/algorithm-info';

import {
  GraphData,
  AlgorithmType,
  AnimationFrame,
  AlgorithmResult,
  FrameHighlight,
} from './models/graph';
import { runDijkstra } from './algorithms/dijkstra';
import { runBellmanFord } from './algorithms/bellman-ford';
import { runFloydWarshall } from './algorithms/floyd-warshall';
import { runEdmondsKarp } from './algorithms/edmonds-karp';
import { runMinCostMaxFlow } from './algorithms/min-cost-max-flow';

interface RandomGraphConfig {
  nodeCount: number;
  density: 'sparse' | 'medium' | 'dense';
  weightMin: number;
  weightMax: number;
  allowNegative: boolean;
  forNetworkFlow: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GraphCanvasComponent,
    ToolbarComponent,
    AnimationControlsComponent,
    DataPanelComponent,
    AlgorithmInfoComponent,
    ResultSummaryComponent,
    CustomScriptPanelComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  graph: GraphData = { nodes: [], edges: [] };
  sourceId: string | null = null;
  targetId: string | null = null;

  currentAlgorithm: AlgorithmType | null = null;
  frames: AnimationFrame[] = [];
  currentFrameIndex = -1;
  isPlaying = false;
  speed: 0.5 | 1 | 2 | 4 = 1;
  currentResult: AlgorithmResult['summary'] | null = null;

  compareMode = false;
  compareResult1: AlgorithmResult | null = null;
  compareResult2: AlgorithmResult | null = null;
  compareFrame1: AnimationFrame | null = null;
  compareFrame2: AnimationFrame | null = null;
  compareFrameIndex = -1;

  constructor(
    private graphService: GraphService,
    private animationService: AnimationService,
    private historyService: HistoryService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    combineLatest([
      this.graphService.graph$,
      this.graphService.sourceId$,
      this.graphService.targetId$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([graph, sourceId, targetId]) => {
        this.graph = graph;
        this.sourceId = sourceId;
        this.targetId = targetId;
      });

    this.animationService.frames$
      .pipe(takeUntil(this.destroy$))
      .subscribe((frames) => {
        this.frames = frames;
        if (frames.length === 0) {
          this.currentFrameIndex = -1;
          this.currentResult = null;
        }
      });

    this.animationService.currentFrameIndex$
      .pipe(takeUntil(this.destroy$))
      .subscribe((idx) => {
        this.currentFrameIndex = idx;
      });

    this.animationService.isPlaying$
      .pipe(takeUntil(this.destroy$))
      .subscribe((v) => {
        this.isPlaying = v;
      });

    this.animationService.speed$
      .pipe(takeUntil(this.destroy$))
      .subscribe((s) => {
        this.speed = s;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get currentFrame(): AnimationFrame | null {
    if (this.currentFrameIndex >= 0 && this.currentFrameIndex < this.frames.length) {
      return this.frames[this.currentFrameIndex];
    }
    return null;
  }

  get currentHighlight(): FrameHighlight | null {
    return this.currentFrame?.highlight || null;
  }

  get currentFrameData() {
    return this.currentFrame?.data || null;
  }

  handleCreateNode(event: { x: number; y: number }): void {
    this.graphService.addNode(event.x, event.y);
  }

  handleCreateEdge(event: {
    from: string;
    to: string;
    weight: number;
    capacity?: number;
    cost?: number;
  }): void {
    this.graphService.addEdge(event.from, event.to, event.weight, event.capacity, event.cost);
  }

  handleDeleteNode(id: string): void {
    this.graphService.deleteNode(id);
  }

  handleDeleteEdge(id: string): void {
    this.graphService.deleteEdge(id);
  }

  handleEditEdge(event: {
    id: string;
    weight: number;
    capacity?: number;
    cost?: number;
  }): void {
    this.graphService.updateEdge(event.id, event.weight, event.capacity, event.cost);
  }

  handleMarkNode(event: { id: string; markType: 'source' | 'target' | 'none' }): void {
    if (event.markType === 'source') {
      this.graphService.setSource(event.id);
    } else if (event.markType === 'target') {
      this.graphService.setTarget(event.id);
    } else {
      const node = this.graph.nodes.find((n) => n.id === event.id);
      if (node?.isSource) {
        this.graphService.setSource(null);
      }
      if (node?.isTarget) {
        this.graphService.setTarget(null);
      }
    }
  }

  handleRunAlgorithm(type: AlgorithmType): void {
    this.compareMode = false;
    this.compareResult1 = null;
    this.compareResult2 = null;
    this.currentAlgorithm = type;

    if (!this.sourceId) {
      alert('请先标记一个起点节点（右键节点→设为起点）');
      return;
    }
    if (
      (type === 'edmonds-karp' || type === 'min-cost-max-flow') &&
      !this.targetId
    ) {
      alert('网络流算法需要同时标记起点和终点');
      return;
    }

    let result: AlgorithmResult | null = null;
    try {
      switch (type) {
        case 'dijkstra':
          result = runDijkstra(this.graph, this.sourceId, this.targetId || undefined);
          break;
        case 'bellman-ford':
          result = runBellmanFord(this.graph, this.sourceId, this.targetId || undefined);
          break;
        case 'floyd-warshall':
          result = runFloydWarshall(this.graph, this.sourceId, this.targetId || undefined);
          break;
        case 'edmonds-karp':
          if (this.targetId) {
            result = runEdmondsKarp(this.graph, this.sourceId, this.targetId);
          }
          break;
        case 'min-cost-max-flow':
          if (this.targetId) {
            result = runMinCostMaxFlow(this.graph, this.sourceId, this.targetId);
          }
          break;
      }
    } catch (e) {
      alert('算法执行出错：' + (e as Error).message);
      return;
    }

    if (result) {
      this.currentResult = result.summary;
      this.animationService.setFrames(result.frames);
      this.saveToHistory(type, result);
    }
  }

  handleRunCustomScript(event: { frames: AnimationFrame[]; scriptName: string }): void {
    this.compareMode = false;
    this.compareResult1 = null;
    this.compareResult2 = null;
    this.currentAlgorithm = 'custom';

    const result: AlgorithmResult = {
      frames: event.frames,
      summary: {
        type: 'custom',
        value: event.frames.length,
        path: undefined,
        scriptName: event.scriptName,
        frameCount: event.frames.length,
      },
    };

    this.currentResult = result.summary;
    this.animationService.setFrames(result.frames);
    this.saveCustomScriptToHistory(event.scriptName, result);
  }

  private saveToHistory(type: AlgorithmType, result: AlgorithmResult): void {
    const algoInfo = ALGORITHM_INFO[type];
    const sourceNode = this.graph.nodes.find((n) => n.id === this.sourceId);
    const targetNode = this.graph.nodes.find((n) => n.id === this.targetId);

    const resultValue = this.extractResultValue(result.summary);
    const resultText = this.formatResultText(result.summary);

    this.historyService.addRecord({
      algorithm: type,
      algorithmName: algoInfo.name,
      graphData: {
        nodes: [...this.graph.nodes],
        edges: [...this.graph.edges],
      },
      sourceId: this.sourceId,
      targetId: this.targetId,
      sourceLabel: sourceNode?.label || null,
      targetLabel: targetNode?.label || null,
      nodeCount: this.graph.nodes.length,
      edgeCount: this.graph.edges.length,
      resultSummary: result.summary,
      frames: [...result.frames],
      frameCount: result.frames.length,
      resultValue,
      resultText,
    });
  }

  private saveCustomScriptToHistory(scriptName: string, result: AlgorithmResult): void {
    const sourceNode = this.graph.nodes.find((n) => n.id === this.sourceId);
    const targetNode = this.graph.nodes.find((n) => n.id === this.targetId);

    const resultValue = this.extractResultValue(result.summary);
    const resultText = this.formatResultText(result.summary);

    this.historyService.addRecord({
      algorithm: 'custom',
      algorithmName: scriptName,
      graphData: {
        nodes: [...this.graph.nodes],
        edges: [...this.graph.edges],
      },
      sourceId: this.sourceId,
      targetId: this.targetId,
      sourceLabel: sourceNode?.label || null,
      targetLabel: targetNode?.label || null,
      nodeCount: this.graph.nodes.length,
      edgeCount: this.graph.edges.length,
      resultSummary: result.summary,
      frames: [...result.frames],
      frameCount: result.frames.length,
      resultValue,
      resultText,
    });
  }

  private extractResultValue(summary: AlgorithmResult['summary']): number | null {
    switch (summary.type) {
      case 'dijkstra':
      case 'bellman-ford':
        return summary.value ?? null;
      case 'floyd-warshall':
        return summary.paths?.length ?? null;
      case 'edmonds-karp':
        return summary.maxFlow ?? null;
      case 'min-cost-max-flow':
        return summary.totalFlow ?? null;
      case 'custom':
        return summary.value ?? null;
      default:
        return null;
    }
  }

  private formatResultText(summary: AlgorithmResult['summary']): string {
    switch (summary.type) {
      case 'dijkstra':
      case 'bellman-ford':
        if (summary.hasNegativeCycle) {
          return '存在负环';
        }
        return summary.value !== undefined ? `距离: ${summary.value}` : '不可达';
      case 'floyd-warshall':
        return `${summary.paths?.length || 0} 对路径`;
      case 'edmonds-karp':
        return `最大流: ${summary.maxFlow ?? '-'}`;
      case 'min-cost-max-flow':
        return `流量: ${summary.totalFlow ?? '-'} / 费用: ${summary.totalCost ?? '-'}`;
      case 'custom':
        return `${summary.value ?? 0} 帧动画`;
      default:
        return '已完成';
    }
  }

  handleRandomGraph(config: RandomGraphConfig): void {
    const data = this.graphService.generateRandomGraph(config);
    this.graphService.loadGraph(data);
    this.animationService.setFrames([]);
    this.currentAlgorithm = null;
    this.currentResult = null;
  }

  handleLoadPreset(name: string): void {
    const preset = PRESET_GRAPHS.find((p) => p.name === name);
    if (preset) {
      this.graphService.loadGraph(preset.graph);
      this.animationService.setFrames([]);
      this.currentAlgorithm = null;
      this.currentResult = null;
      this.compareMode = false;
    }
  }

  handleExportJson(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const json = this.graphService.toJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `graph-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  handleImportJson(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.graphService.fromJson(reader.result as string);
        this.animationService.setFrames([]);
        this.currentAlgorithm = null;
        this.currentResult = null;
      } catch {
        alert('JSON 文件格式错误');
      }
    };
    reader.readAsText(file);
  }

  handleExportPng(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const svg = document.querySelector('svg.graph-canvas') as SVGSVGElement | null;
    if (!svg) {
      alert('未找到画布');
      return;
    }

    const clone = svg.cloneNode(true) as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    clone.setAttribute('width', String(rect.width));
    clone.setAttribute('height', String(rect.height));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (blob) {
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `graph-${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(pngUrl);
        }
      }, 'image/png');
    };
    img.src = url;
  }

  handleClearGraph(): void {
    this.graphService.clearGraph();
    this.animationService.setFrames([]);
    this.currentAlgorithm = null;
    this.currentResult = null;
    this.compareMode = false;
  }

  handleToggleCompareMode(): void {
    this.compareMode = !this.compareMode;
    if (this.compareMode) {
      if (!this.sourceId || !this.targetId) {
        alert('对比模式需要同时标记起点和终点');
        this.compareMode = false;
        return;
      }
      this.currentAlgorithm = null;
      this.animationService.setFrames([]);
      this.currentResult = null;

      this.compareResult1 = runDijkstra(this.graph, this.sourceId, this.targetId);
      this.compareResult2 = runBellmanFord(this.graph, this.sourceId, this.targetId);
      this.compareFrameIndex = 0;
      this.updateCompareFrames();
    } else {
      this.compareResult1 = null;
      this.compareResult2 = null;
      this.compareFrameIndex = -1;
    }
  }

  private updateCompareFrames(): void {
    if (!this.compareResult1 || !this.compareResult2) return;
    const idx = this.compareFrameIndex;
    this.compareFrame1 =
      idx >= 0 && idx < this.compareResult1.frames.length
        ? this.compareResult1.frames[idx]
        : null;
    this.compareFrame2 =
      idx >= 0 && idx < this.compareResult2.frames.length
        ? this.compareResult2.frames[idx]
        : null;
  }

  compareStepForward(): void {
    const max1 = this.compareResult1?.frames.length || 0;
    const max2 = this.compareResult2?.frames.length || 0;
    const max = Math.max(max1, max2);
    if (this.compareFrameIndex < max - 1) {
      this.compareFrameIndex++;
      this.updateCompareFrames();
    }
  }

  compareStepBack(): void {
    if (this.compareFrameIndex > 0) {
      this.compareFrameIndex--;
      this.updateCompareFrames();
    }
  }

  get compareMaxFrames(): number {
    return Math.max(
      this.compareResult1?.frames.length || 0,
      this.compareResult2?.frames.length || 0
    );
  }

  handlePlay(): void {
    this.animationService.play();
  }
  handlePause(): void {
    this.animationService.pause();
  }
  handleStepForward(): void {
    this.animationService.stepForward();
  }
  handleStepBack(): void {
    this.animationService.stepBack();
  }
  handleSeek(frame: number): void {
    this.animationService.seek(frame);
  }
  handleChangeSpeed(speed: number): void {
    this.animationService.setSpeed(speed as 0.5 | 1 | 2 | 4);
  }

  handleReplayHistory(record: HistoryRecord): void {
    const isSameGraph = this.historyService.isGraphSameAsRecord(this.graph, record);

    if (!isSameGraph && this.graph.nodes.length > 0) {
      const confirmed = confirm('回放会覆盖当前画布内容，是否继续？');
      if (!confirmed) return;
    }

    this.compareMode = false;
    this.compareResult1 = null;
    this.compareResult2 = null;
    this.currentAlgorithm = record.algorithm;
    this.currentResult = record.resultSummary;

    this.graphService.loadGraph(record.graphData);
    this.animationService.setFrames([...record.frames]);
  }

  translateDescription(description: string): string {
    if (!description) return description;
    const sortedNodes = [...this.graph.nodes].sort(
      (a, b) => b.id.length - a.id.length
    );
    let result = description;
    for (const node of sortedNodes) {
      const regex = new RegExp(node.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      result = result.replace(regex, node.label);
    }
    return result;
  }
}
