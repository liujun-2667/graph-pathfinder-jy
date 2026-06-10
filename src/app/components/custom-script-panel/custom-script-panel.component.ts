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
} from '../../services/script-executor.service';
import { GraphData, AnimationFrame, AlgorithmResult } from '../../models/graph';
import { GraphService } from '../../services/graph.service';

declare const monaco: any;
declare const require: any;

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

  @ViewChild('editorContainer') editorContainer!: ElementRef<HTMLDivElement>;

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

  savedScripts: SavedScript[] = [];
  exampleScripts: ExampleScript[] = [];

  showSaveDialog = false;
  newScriptName = '';

  showLoadDialog = false;
  showManageDialog = false;

  constructor(
    public scriptExecutor: ScriptExecutorService,
    private graphService: GraphService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    this.exampleScripts = this.scriptExecutor.getExamples();
    this.savedScripts = this.scriptExecutor.getSavedScripts();

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
    });

    this.editor.onDidChangeModelContent(() => {
      this.executionError = null;
      this.validationResult = null;
    });
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

  onRunScript(): void {
    if (!this.sourceId) {
      alert('请先标记一个起点节点（右键节点→设为起点）');
      return;
    }

    this.isRunning = true;
    this.executionError = null;
    this.validationResult = null;

    const code = this.getCode();
    const result = this.scriptExecutor.executeScript(
      code,
      this.graph,
      this.sourceId,
      this.targetId
    );

    this.isRunning = false;

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

    this.runScript.emit({
      frames: result.frames,
      scriptName: this.scriptName,
    });
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
    }
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
}
