import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import {
  GraphData,
  AlgorithmType,
  AnimationFrame,
  AlgorithmResult,
} from '../models/graph';

export interface HistoryRecord {
  id: string;
  algorithm: AlgorithmType;
  algorithmName: string;
  graphData: GraphData;
  sourceId: string | null;
  targetId: string | null;
  sourceLabel: string | null;
  targetLabel: string | null;
  nodeCount: number;
  edgeCount: number;
  resultSummary: AlgorithmResult['summary'];
  frames: AnimationFrame[];
  frameCount: number;
  timestamp: number;
  resultValue: number | null;
  resultText: string;
}

const STORAGE_KEY = 'graph-algorithm-history';
const MAX_HISTORY = 20;

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly historySubject = new BehaviorSubject<HistoryRecord[]>([]);
  readonly history$ = this.historySubject.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const records = JSON.parse(stored) as HistoryRecord[];
        this.historySubject.next(records);
      }
    } catch {
      console.warn('Failed to load history from localStorage');
    }
  }

  private saveToStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.historySubject.value)
      );
    } catch {
      console.warn('Failed to save history to localStorage');
    }
  }

  addRecord(record: Omit<HistoryRecord, 'id' | 'timestamp'>): HistoryRecord {
    const newRecord: HistoryRecord = {
      ...record,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    const current = this.historySubject.value;
    const updated = [newRecord, ...current].slice(0, MAX_HISTORY);
    this.historySubject.next(updated);
    this.saveToStorage();
    return newRecord;
  }

  getRecords(): HistoryRecord[] {
    return this.historySubject.value;
  }

  getRecordById(id: string): HistoryRecord | undefined {
    return this.historySubject.value.find((r) => r.id === id);
  }

  clearHistory(): void {
    this.historySubject.next([]);
    this.saveToStorage();
  }

  isGraphSameAsRecord(graphData: GraphData, record: HistoryRecord): boolean {
    const currentNodes = graphData.nodes;
    const recordNodes = record.graphData.nodes;
    const currentEdges = graphData.edges;
    const recordEdges = record.graphData.edges;

    if (currentNodes.length !== recordNodes.length) return false;
    if (currentEdges.length !== recordEdges.length) return false;

    const currentNodeLabels = currentNodes
      .map((n) => n.label)
      .sort()
      .join(',');
    const recordNodeLabels = recordNodes
      .map((n) => n.label)
      .sort()
      .join(',');
    if (currentNodeLabels !== recordNodeLabels) return false;

    const currentEdgeKeys = currentEdges
      .map((e) => {
        const fromNode = currentNodes.find((n) => n.id === e.from);
        const toNode = currentNodes.find((n) => n.id === e.to);
        return `${fromNode?.label || e.from}-${toNode?.label || e.to}-${e.weight}-${e.capacity || ''}-${e.cost || ''}`;
      })
      .sort()
      .join('|');
    const recordEdgeKeys = recordEdges
      .map((e) => {
        const fromNode = recordNodes.find((n) => n.id === e.from);
        const toNode = recordNodes.find((n) => n.id === e.to);
        return `${fromNode?.label || e.from}-${toNode?.label || e.to}-${e.weight}-${e.capacity || ''}-${e.cost || ''}`;
      })
      .sort()
      .join('|');

    return currentEdgeKeys === recordEdgeKeys;
  }

  private generateId(): string {
    return `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
