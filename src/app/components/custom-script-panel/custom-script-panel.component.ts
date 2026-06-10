import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
  Input,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {
  ScriptExecutorService,
  ScriptError,
  ValidationResult,
  SavedScript,
  ExampleScript,
  DebugFrame,
  DebugExecutionResult,
} from '../../services/script-executor.service';
import { GraphData, AnimationFrame, AlgorithmResult } from '../../models/graph';
import { GraphService } from '../../services/graph.service';
import { AnimationService } from '../../services/animation.service';

declare const monaco: any;
declare const require: any;

interface LogEntry {
  frameIndex: number;
  timestamp: number;
  description: string;
  lineNumber: number;
}

interface VarNode {
  key: string;
  value: any;
  type: 'primitive' | 'object' | 'array' | 'set' | 'map' | 'function';
  expanded?: boolean;
  children?: VarNode[];
}

@Component({
  selector: 'app-custom-script-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './custom-script-panel.component.html',
  styleUrl: './custom-script-panel.component.scss',
})
export class CustomScriptPanelComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  private readonly destroy$ = new Subject<void>();
  private editor: any = null;
  private monacoLoaded = false;
  private breakpointDecorations: string[] = [];
  private currentLineDecoration: string[] = [];

  @ViewChild('editorContainer') editorContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('logContainer') logContainer!: ElementRef<HTMLDivElement>;

  @Output() runScript = new EventEmitter<{
    frames: AnimationFrame[];
    scriptName: string;
  }>();

  @Input() graph: GraphData = { nodes: [], edges: [] };
  @Input() sourceId: string | null = null;
  @Input() targetId: string | null = null;

  isCollapsed = false;
  scriptName = '我的脚本';
  selectedExample = '';
  selectedSavedScript = '';

  executionError: ScriptError | null = null;
  validationResult: ValidationResult | null = null;
  isRunning = false;
  isValidating = false;
  isExecuting = false;

  savedScripts: SavedScript[] = [];
  exampleScripts: ExampleScript[] = [];

  showSaveDialog = false;
  newScriptName = '';

  showLoadDialog = false;
  showManageDialog = false;

  currentScriptId: string = '';
  breakpoints: number[] = [];

  debugFrames: DebugFrame[] = [];
  currentFrameIndex = -1;
  isDebugMode = false;
  isDebugPaused = false;
  skipBreakpointOnContinue = false;
  isAnimationPlaying = false;

  showVariablesPanel = true;
  variableNodes: VarNode[] = [];

  showLogPanel = true;
  logEntries: LogEntry[] = [];
  readonly MAX_LOG_ENTRIES = 50;

  executionProgress = 0;
  showTimeoutWarning = false;

  constructor(
    public scriptExecutor: ScriptExecutorService,
    private graphService: GraphService,
    private animationService: AnimationService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    this.exampleScripts = this.scriptExecutor.getExamples();
    this.savedScripts = this.scriptExecutor.getSavedScripts();
    this.currentScriptId = this.scriptExecutor.getDefaultBreakpointsKey();
    this.loadBreakpoints();

    this.graphService.graph$
      .pipe(takeUntil(this.destroy$))
      .subscribe((graph) => {
        this.graph = graph;
      });

    this.graphService.sourceId$
      .pipe(takeUntil(this.destroy$))
      .subscribe((sourceId) => {
        this.sourceId = sourceId;
      });

    this.graphService.targetId$
      .pipe(takeUntil(this.destroy$))
      .subscribe((targetId) => {
        this.targetId = targetId;
      });

    this.animationService.isPlaying$
      .pipe(takeUntil(this.destroy$))
      .subscribe((playing) => {
        this.isAnimationPlaying = playing;
        if (!playing) {
          this.isDebugPaused = this.debugFrames.length > 0 && this.currentFrameIndex >= 0;
        }
      });

    this.animationService.currentFrameIndex$
      .pipe(takeUntil(this.destroy$))
      .subscribe((idx) => {
        if (this.debugFrames.length > 0 && idx >= 0) {
          this.currentFrameIndex = idx;
          this.updateEditorHighlight();
          this.updateVariables();

          const frame = this.debugFrames[idx];
          const isAtBreakpoint = frame && this.hasBreakpointAtFrame(frame);

          if (isAtBreakpoint && !this.skipBreakpointOnContinue && this.isAnimationPlaying) {
            this.animationService.pause();
            this.isDebugPaused = true;
          }

          if (!isAtBreakpoint && this.skipBreakpointOnContinue) {
            this.skipBreakpointOnContinue = false;
          }
        }
      });

    this.animationService.frames$
      .pipe(takeUntil(this.destroy$))
      .subscribe((frames) => {
        if (frames.length === 0) {
          this.debugFrames = [];
          this.currentFrameIndex = -1;
          this.clearEditorHighlight();
          this.variableNodes = [];
          this.logEntries = [];
        }
      });
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadMonacoEditor();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.editor) {
      this.editor.dispose();
    }
  }

  private loadMonacoEditor(): void {
    if (typeof monaco !== 'undefined') {
      this.monacoLoaded = true;
      this.initEditor();
      return;
    }

    if (typeof require !== 'undefined') {
      require(['vs/editor/editor.main'], () => {
        this.monacoLoaded = true;
        this.initEditor();
      });
    }
  }

  private initEditor(): void {
    if (!this.editorContainer || !monaco) return;

    this.editor = monaco.editor.create(this.editorContainer.nativeElement, {
      value: this.scriptExecutor.getDefaultTemplate(),
      language: 'javascript',
      theme: 'vs-dark',
      fontSize: 13,
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      wrappingIndent: 'indent',
      glyphMargin: true,
      lineDecorationsWidth: 0,
    });

    this.editor.onDidChangeModelContent(() => {
      this.executionError = null;
      this.validationResult = null;
    });

    this.editor.onMouseDown((e: any) => {
      const targetType = e.target?.type;
      const isGutterClick = targetType === 1 || targetType === 2 || targetType === 4;
      if (isGutterClick) {
        const lineNumber = e.target.position?.lineNumber;
        if (lineNumber) {
          this.toggleBreakpoint(lineNumber);
        }
      }
    });

    this.renderBreakpoints();
  }

  getCode(): string {
    if (this.editor) {
      return this.editor.getValue();
    }
    return '';
  }

  setCode(code: string): void {
    if (this.editor) {
      this.editor.setValue(code);
    }
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    if (!this.isCollapsed && this.editor) {
      setTimeout(() => {
        this.editor.layout();
      }, 100);
    }
  }

  toggleBreakpoint(lineNumber: number): void {
    const idx = this.breakpoints.indexOf(lineNumber);
    if (idx === -1) {
      this.breakpoints.push(lineNumber);
    } else {
      this.breakpoints.splice(idx, 1);
    }
    this.breakpoints.sort((a, b) => a - b);
    this.renderBreakpoints();
    this.saveBreakpoints();
  }

  private renderBreakpoints(): void {
    if (!this.editor || !monaco) return;

    const decorations = this.breakpoints.map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: 'breakpoint-glyph',
        linesDecorationsClassName: 'breakpoint-line',
      },
    }));

    this.breakpointDecorations = this.editor.deltaDecorations(
      this.breakpointDecorations,
      decorations
    );
  }

  private updateEditorHighlight(): void {
    if (!this.editor || !monaco || this.currentFrameIndex < 0) return;

    const frame = this.debugFrames[this.currentFrameIndex];
    if (!frame || !frame.__debugLine__) return;

    const line = frame.__debugLine__;

    const decorations = [
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'current-line-highlight',
          linesDecorationsClassName: 'current-line-marker',
        },
      },
    ];

    this.currentLineDecoration = this.editor.deltaDecorations(
      this.currentLineDecoration,
      decorations
    );

    this.editor.revealLineInCenter(line);
  }

  private clearEditorHighlight(): void {
    if (!this.editor) return;
    this.currentLineDecoration = this.editor.deltaDecorations(
      this.currentLineDecoration,
      []
    );
  }

  private updateVariables(): void {
    if (this.currentFrameIndex < 0 || this.currentFrameIndex >= this.debugFrames.length) {
      this.variableNodes = [];
      return;
    }

    const frame = this.debugFrames[this.currentFrameIndex];
    const vars = frame.__debugVars__ || {};

    const processedVars: Record<string, any> = {};
    for (const [key, value] of Object.entries(vars)) {
      processedVars[key] = this.scriptExecutor.deepCloneVariables(value, 2);
    }

    this.variableNodes = this.buildVariableTree(processedVars);
  }

  private buildVariableTree(obj: Record<string, any>): VarNode[] {
    const nodes: VarNode[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const node = this.buildVarNode(key, value);
      if (node) {
        nodes.push(node);
      }
    }

    return nodes;
  }

  private buildVarNode(key: string, value: any): VarNode | null {
    if (value === undefined) return null;

    let type: VarNode['type'] = 'primitive';
    let children: VarNode[] | undefined;
    let expanded = false;

    if (value === null) {
      return { key, value: 'null', type: 'primitive' };
    }

    if (typeof value === 'function') {
      return { key, value: 'ƒ function()', type: 'function' };
    }

    if (Array.isArray(value)) {
      type = 'array';
      if (value.length > 0 && typeof value[0] !== 'object') {
        children = value.map((v, i) => this.buildVarNode(String(i), v)!).filter(Boolean);
      } else if (value.length > 0) {
        children = value.map((v, i) => this.buildVarNode(String(i), v)!).filter(Boolean);
        expanded = true;
      }
      return { key, value: `[${value.length} 项]`, type, expanded, children };
    }

    if (typeof value === 'object') {
      if (value.__type__ === 'Set') {
        const values = value.values || [];
        type = 'set';
        children = values.map((v: any, i: number) => this.buildVarNode(String(i), v)!).filter(Boolean);
        return { key, value: `Set(${values.length})`, type, expanded: false, children };
      }

      if (value.__type__ === 'Map') {
        const entries = value.entries || [];
        type = 'map';
        children = entries.map((e: any, i: number) => 
          this.buildVarNode(String(e.key), e.value)!
        ).filter(Boolean);
        return { key, value: `Map(${entries.length})`, type, expanded: false, children };
      }

      const keys = Object.keys(value);
      type = 'object';
      if (keys.length > 0) {
        children = keys.map((k) => this.buildVarNode(k, value[k])!).filter(Boolean);
        expanded = true;
      }
      return { key, value: `{${keys.length} 个字段}`, type, expanded, children };
    }

    if (typeof value === 'string') {
      return { key, value: `"${value}"`, type: 'primitive' };
    }

    return { key, value: String(value), type: 'primitive' };
  }

  toggleVarNode(node: VarNode): void {
    if (node.type === 'primitive' || node.type === 'function') return;
    node.expanded = !node.expanded;
  }

  hasBreakpointAtFrame(frame: DebugFrame): boolean {
    if (!frame.__debugLine__) return false;
    return this.breakpoints.includes(frame.__debugLine__);
  }

  findNextBreakpoint(fromIndex: number): number {
    for (let i = fromIndex + 1; i < this.debugFrames.length; i++) {
      if (this.hasBreakpointAtFrame(this.debugFrames[i])) {
        return i;
      }
    }
    return -1;
  }

  onRunScript(): void {
    if (!this.sourceId) {
      alert('请先标记一个起点节点（右键节点→设为起点）');
      return;
    }

    this.isRunning = true;
    this.isExecuting = true;
    this.executionError = null;
    this.validationResult = null;
    this.showTimeoutWarning = false;
    this.executionProgress = 0;

    const code = this.getCode();

    setTimeout(() => {
      const result = this.scriptExecutor.executeScriptDebug(
        code,
        this.graph,
        this.sourceId,
        this.targetId
      );

      this.isExecuting = false;
      this.isRunning = false;
      this.executionProgress = 100;

      if (result.timedOut) {
        this.showTimeoutWarning = true;
        this.executionError = {
          message: '执行超时,可能存在死循环',
        };
        this.restoreCanvasState();
        return;
      }

      if (result.error) {
        this.executionError = result.error;
        return;
      }

      if (result.frames.length === 0) {
        this.executionError = {
          message: '脚本返回了空的帧数组',
        };
        return;
      }

      this.debugFrames = result.frames;
      this.buildLogEntries(result.frames);

      this.runScript.emit({
        frames: result.frames as AnimationFrame[],
        scriptName: this.scriptName,
      });

      this.isDebugMode = true;
      this.isDebugPaused = true;
    }, 50);
  }

  private buildLogEntries(frames: DebugFrame[]): void {
    const allEntries = frames.map((frame, idx) => ({
      frameIndex: idx,
      timestamp: frame.__debugTimestamp__,
      description: frame.description,
      lineNumber: frame.__debugLine__,
    }));

    if (allEntries.length > this.MAX_LOG_ENTRIES) {
      this.logEntries = allEntries.slice(allEntries.length - this.MAX_LOG_ENTRIES);
    } else {
      this.logEntries = allEntries;
    }

    setTimeout(() => {
      this.scrollLogToBottom();
    }, 50);
  }

  private scrollLogToBottom(): void {
    if (this.logContainer?.nativeElement) {
      const el = this.logContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  onStepForward(): void {
    if (this.debugFrames.length === 0) return;
    if (this.currentFrameIndex < this.debugFrames.length - 1) {
      this.animationService.stepForward();
    }
  }

  onContinue(): void {
    if (this.debugFrames.length === 0) return;
    if (this.currentFrameIndex < 0) {
      this.skipBreakpointOnContinue = true;
      this.animationService.play();
      this.isDebugPaused = false;
      return;
    }

    const currentFrame = this.debugFrames[this.currentFrameIndex];
    if (currentFrame && this.hasBreakpointAtFrame(currentFrame)) {
      this.skipBreakpointOnContinue = true;
    }

    if (this.currentFrameIndex >= this.debugFrames.length - 1) {
      return;
    }

    this.animationService.play();
    this.isDebugPaused = false;
  }

  onValidate(): void {
    this.isValidating = true;
    this.executionError = null;
    this.validationResult = null;

    const code = this.getCode();
    const result = this.scriptExecutor.executeScript(
      code,
      this.graph,
      this.sourceId || 'node_0',
      this.targetId
    );

    this.isValidating = false;

    if (result.error) {
      this.executionError = result.error;
      return;
    }

    const validation = this.scriptExecutor.validateFrames(result.frames);
    this.validationResult = validation;
  }

  onSelectExample(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const exampleId = select.value;
    if (!exampleId) return;

    const example = this.scriptExecutor.getExampleById(exampleId);
    if (example) {
      this.setCode(example.code);
      this.scriptName = example.name;
      this.executionError = null;
      this.validationResult = null;
      
      this.currentScriptId = `example_${exampleId}`;
      this.loadBreakpoints();
    }

    select.value = '';
  }

  openSaveDialog(): void {
    this.newScriptName = this.scriptName;
    this.showSaveDialog = true;
  }

  closeSaveDialog(): void {
    this.showSaveDialog = false;
    this.newScriptName = '';
  }

  onSaveScript(): void {
    if (!this.newScriptName.trim()) {
      alert('请输入脚本名称');
      return;
    }

    const code = this.getCode();
    const saved = this.scriptExecutor.saveScript(
      this.newScriptName.trim(),
      code
    );

    if (!saved) {
      alert(
        `保存失败，最多只能保存 ${this.scriptExecutor.getMaxSavedScripts()} 个脚本`
      );
      return;
    }

    this.scriptName = saved.name;
    this.currentScriptId = saved.id;
    this.saveBreakpoints();
    
    this.savedScripts = this.scriptExecutor.getSavedScripts();
    this.closeSaveDialog();
  }

  openLoadDialog(): void {
    this.savedScripts = this.scriptExecutor.getSavedScripts();
    this.showLoadDialog = true;
  }

  closeLoadDialog(): void {
    this.showLoadDialog = false;
  }

  onLoadScript(script: SavedScript): void {
    this.setCode(script.code);
    this.scriptName = script.name;
    this.executionError = null;
    this.validationResult = null;
    
    this.currentScriptId = script.id;
    this.loadBreakpoints();
    
    this.closeLoadDialog();
  }

  openManageDialog(): void {
    this.savedScripts = this.scriptExecutor.getSavedScripts();
    this.showManageDialog = true;
  }

  closeManageDialog(): void {
    this.showManageDialog = false;
  }

  onDeleteScript(script: SavedScript): void {
    if (confirm(`确定要删除脚本「${script.name}」吗？`)) {
      this.scriptExecutor.deleteScript(script.id);
      this.savedScripts = this.scriptExecutor.getSavedScripts();
      
      if (this.currentScriptId === script.id) {
        this.currentScriptId = this.scriptExecutor.getDefaultBreakpointsKey();
        this.breakpoints = [];
        this.renderBreakpoints();
      }
    }
  }

  private loadBreakpoints(): void {
    this.breakpoints = this.scriptExecutor.getBreakpoints(this.currentScriptId);
    this.renderBreakpoints();
  }

  private saveBreakpoints(): void {
    this.scriptExecutor.saveBreakpoints(this.currentScriptId, this.breakpoints);
  }

  onLogClick(entry: LogEntry): void {
    if (entry.frameIndex >= 0 && entry.frameIndex < this.debugFrames.length) {
      this.animationService.seek(entry.frameIndex);
    }
  }

  formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getErrorLineNumber(): number | null {
    if (!this.executionError?.lineNumber) return null;
    return this.executionError.lineNumber;
  }

  private restoreCanvasState(): void {
    this.animationService.setFrames([]);
  }

  toggleVariablesPanel(): void {
    this.showVariablesPanel = !this.showVariablesPanel;
  }

  toggleLogPanel(): void {
    this.showLogPanel = !this.showLogPanel;
    if (this.showLogPanel) {
      setTimeout(() => this.scrollLogToBottom(), 50);
    }
  }

  get hasFrames(): boolean {
    return this.debugFrames.length > 0;
  }

  get canStep(): boolean {
    return this.hasFrames && this.currentFrameIndex < this.debugFrames.length - 1;
  }

  get canContinue(): boolean {
    return this.hasFrames;
  }
}
