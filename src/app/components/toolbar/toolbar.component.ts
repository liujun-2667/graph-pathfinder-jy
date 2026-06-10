import { Component, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlgorithmType } from '../../models/graph';

export interface RandomGraphConfig {
  nodeCount: number;
  density: 'sparse' | 'medium' | 'dense';
  weightMin: number;
  weightMax: number;
  allowNegative: boolean;
  forNetworkFlow: boolean;
}

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss'
})
export class ToolbarComponent {
  @Output() runAlgorithm = new EventEmitter<AlgorithmType>();
  @Output() randomGraph = new EventEmitter<RandomGraphConfig>();
  @Output() loadPreset = new EventEmitter<string>();
  @Output() exportJson = new EventEmitter<void>();
  @Output() importJson = new EventEmitter<File>();
  @Output() exportPng = new EventEmitter<void>();
  @Output() clearGraph = new EventEmitter<void>();
  @Output() toggleCompareMode = new EventEmitter<boolean>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  selectedAlgorithm: AlgorithmType = 'dijkstra';
  compareMode = false;

  showRandomDialog = false;
  showPresetDialog = false;

  randomConfig: RandomGraphConfig = {
    nodeCount: 10,
    density: 'medium',
    weightMin: 1,
    weightMax: 10,
    allowNegative: false,
    forNetworkFlow: false,
  };

  presets = [
    { name: '简单4节点最短路径', description: '经典Dijkstra演示，4节点多路径图' },
    { name: '含负权边图', description: 'Bellman-Ford演示，含负权边但无负环' },
    { name: '含负环图', description: '负环检测演示，存在可达负权环' },
    { name: '标准网络流图', description: 'Edmonds-Karp演示，标准最大流网络' },
    { name: '最小费用最大流', description: 'Min-Cost-Max-Flow演示，含容量和费用' }
  ];

  algorithmOptions: { value: AlgorithmType; label: string }[] = [
    { value: 'dijkstra', label: 'Dijkstra 算法' },
    { value: 'bellman-ford', label: 'Bellman-Ford 算法' },
    { value: 'floyd-warshall', label: 'Floyd-Warshall 算法' },
    { value: 'edmonds-karp', label: 'Edmonds-Karp 算法' },
    { value: 'min-cost-max-flow', label: '最小费用最大流' }
  ];

  onRun(): void {
    this.runAlgorithm.emit(this.selectedAlgorithm);
  }

  onToggleCompareMode(): void {
    this.compareMode = !this.compareMode;
    this.toggleCompareMode.emit();
  }

  openRandomDialog(): void {
    this.showRandomDialog = true;
  }

  closeRandomDialog(): void {
    this.showRandomDialog = false;
  }

  confirmRandom(): void {
    this.randomGraph.emit({ ...this.randomConfig });
    this.showRandomDialog = false;
  }

  openPresetDialog(): void {
    this.showPresetDialog = true;
  }

  closePresetDialog(): void {
    this.showPresetDialog = false;
  }

  selectPreset(name: string): void {
    this.loadPreset.emit(name);
    this.showPresetDialog = false;
  }

  onImportClick(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.importJson.emit(input.files[0]);
      input.value = '';
    }
  }
}
