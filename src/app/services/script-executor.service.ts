import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  GraphData,
  AnimationFrame,
  FrameHighlight,
  NodeColorState,
  EdgeColorState,
  AlgorithmResult,
} from '../models/graph';

export interface ScriptError {
  message: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: { frameIndex: number; field: string; message: string }[];
}

export interface SavedScript {
  id: string;
  name: string;
  code: string;
  createdAt: number;
}

export interface ExampleScript {
  id: string;
  name: string;
  description: string;
  code: string;
}

export interface DebugFrame extends AnimationFrame {
  __debugLine__: number;
  __debugVars__: Record<string, any>;
  __debugTimestamp__: number;
}

export interface DebugExecutionResult {
  frames: DebugFrame[];
  error?: ScriptError;
  timedOut?: boolean;
  executionTime?: number;
}

export interface ExecutionLogEntry {
  frameIndex: number;
  timestamp: number;
  description: string;
  lineNumber: number;
}

const STORAGE_KEY = 'graph-custom-scripts';
const BREAKPOINTS_STORAGE_KEY = 'graph-custom-scripts-breakpoints';
const MAX_SAVED_SCRIPTS = 10;
const EXECUTION_TIMEOUT_MS = 3000;

const BFS_EXAMPLE = `function myAlgorithm(graph, sourceId, targetId) {
  const frames = [];
  let frameIndex = 0;

  const visited = new Set();
  const queue = [sourceId];
  visited.add(sourceId);

  const nodeStates = {};
  const edgeStates = {};

  graph.nodes.forEach(node => {
    nodeStates[node.id] = 'default';
  });
  graph.edges.forEach(edge => {
    edgeStates[edge.id] = 'default';
  });

  if (sourceId) nodeStates[sourceId] = 'source';
  if (targetId) nodeStates[targetId] = 'target';

  const addFrame = (description, data = {}) => {
    frames.push({
      index: frameIndex++,
      description,
      highlight: {
        nodeStates: { ...nodeStates },
        edgeStates: { ...edgeStates }
      },
      data
    });
  };

  addFrame(\`BFS 遍历开始，从源节点 \${sourceId} 出发\`, {
    currentNode: sourceId,
    visitedNodes: [sourceId],
    queue: [sourceId]
  });

  const edgeMap = new Map();
  graph.edges.forEach(edge => {
    if (!edgeMap.has(edge.from)) {
      edgeMap.set(edge.from, []);
    }
    edgeMap.get(edge.from).push(edge);
    if (!edgeMap.has(edge.to)) {
      edgeMap.set(edge.to, []);
    }
    edgeMap.get(edge.to).push({ ...edge, from: edge.to, to: edge.from });
  });

  while (queue.length > 0) {
    const current = queue.shift();
    
    if (current !== sourceId && current !== targetId) {
      nodeStates[current] = 'visiting';
    }
    
    addFrame(\`访问节点 \${current}\`, {
      currentNode: current,
      visitedNodes: Array.from(visited),
      queue: [...queue]
    });

    if (targetId && current === targetId) {
      addFrame(\`到达目标节点 \${targetId}，遍历结束\`, {
        currentNode: current,
        visitedNodes: Array.from(visited),
        queue: [...queue]
      });
      break;
    }

    const neighbors = edgeMap.get(current) || [];
    for (const edge of neighbors) {
      const next = edge.to;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
        
        edgeStates[edge.id] = 'in-tree';
        
        addFrame(\`发现新节点 \${next}，加入队列\`, {
          currentNode: current,
          discoveredNode: next,
          visitedNodes: Array.from(visited),
          queue: [...queue]
        });
      }
    }

    if (current !== sourceId && current !== targetId) {
      nodeStates[current] = 'visited';
    }
  }

  addFrame(\`BFS 遍历完成，共访问 \${visited.size} 个节点\`, {
    visitedNodes: Array.from(visited),
    totalVisited: visited.size
  });

  return frames;
}`;

const DFS_EXAMPLE = `function myAlgorithm(graph, sourceId, targetId) {
  const frames = [];
  let frameIndex = 0;

  const visited = new Set();

  const nodeStates = {};
  const edgeStates = {};

  graph.nodes.forEach(node => {
    nodeStates[node.id] = 'default';
  });
  graph.edges.forEach(edge => {
    edgeStates[edge.id] = 'default';
  });

  if (sourceId) nodeStates[sourceId] = 'source';
  if (targetId) nodeStates[targetId] = 'target';

  const addFrame = (description, data = {}) => {
    frames.push({
      index: frameIndex++,
      description,
      highlight: {
        nodeStates: { ...nodeStates },
        edgeStates: { ...edgeStates }
      },
      data
    });
  };

  const edgeMap = new Map();
  graph.edges.forEach(edge => {
    if (!edgeMap.has(edge.from)) {
      edgeMap.set(edge.from, []);
    }
    edgeMap.get(edge.from).push(edge);
    if (!edgeMap.has(edge.to)) {
      edgeMap.set(edge.to, []);
    }
    edgeMap.get(edge.to).push({ ...edge, from: edge.to, to: edge.from });
  });

  const path = [];
  let found = false;

  const dfs = (nodeId) => {
    if (found) return;
    
    visited.add(nodeId);
    path.push(nodeId);
    
    if (nodeId !== sourceId && nodeId !== targetId) {
      nodeStates[nodeId] = 'visiting';
    }
    
    addFrame(\`深度优先访问节点 \${nodeId}\`, {
      currentNode: nodeId,
      visitedNodes: Array.from(visited),
      currentPath: [...path],
      pathDepth: path.length
    });

    if (targetId && nodeId === targetId) {
      found = true;
      addFrame(\`找到目标节点 \${targetId}！\`, {
        currentNode: nodeId,
        visitedNodes: Array.from(visited),
        currentPath: [...path],
        found: true
      });
      return;
    }

    const neighbors = edgeMap.get(nodeId) || [];
    for (const edge of neighbors) {
      const next = edge.to;
      if (!visited.has(next)) {
        edgeStates[edge.id] = 'in-tree';
        dfs(next);
        if (found) return;
        
        edgeStates[edge.id] = 'default';
        addFrame(\`回溯：从 \${next} 返回到 \${nodeId}\`, {
          currentNode: nodeId,
          backtrackFrom: next,
          visitedNodes: Array.from(visited),
          currentPath: [...path]
        });
      }
    }

    if (nodeId !== sourceId && nodeId !== targetId) {
      nodeStates[nodeId] = 'visited';
    }
    path.pop();
  };

  addFrame(\`DFS 遍历开始，从源节点 \${sourceId} 出发\`, {
    currentNode: sourceId,
    visitedNodes: [],
    currentPath: []
  });

  dfs(sourceId);

  addFrame(\`DFS 遍历完成，共访问 \${visited.size} 个节点\`, {
    visitedNodes: Array.from(visited),
    totalVisited: visited.size,
    foundTarget: found
  });

  return frames;
}`;

const SHORTEST_PATH_EXAMPLE = `function myAlgorithm(graph, sourceId, targetId) {
  const frames = [];
  let frameIndex = 0;

  const distances = {};
  const previous = {};
  const visited = new Set();

  const nodeStates = {};
  const edgeStates = {};

  graph.nodes.forEach(node => {
    distances[node.id] = Infinity;
    previous[node.id] = null;
    nodeStates[node.id] = 'default';
  });
  graph.edges.forEach(edge => {
    edgeStates[edge.id] = 'default';
  });

  distances[sourceId] = 0;
  if (sourceId) nodeStates[sourceId] = 'source';
  if (targetId) nodeStates[targetId] = 'target';

  const addFrame = (description, data = {}) => {
    frames.push({
      index: frameIndex++,
      description,
      highlight: {
        nodeStates: { ...nodeStates },
        edgeStates: { ...edgeStates }
      },
      data: {
        distances: { ...distances },
        previous: { ...previous },
        ...data
      }
    });
  };

  const edgeMap = new Map();
  graph.edges.forEach(edge => {
    if (!edgeMap.has(edge.from)) {
      edgeMap.set(edge.from, []);
    }
    edgeMap.get(edge.from).push(edge);
    if (!edgeMap.has(edge.to)) {
      edgeMap.set(edge.to, []);
    }
    edgeMap.get(edge.to).push({ ...edge, from: edge.to, to: edge.from });
  });

  addFrame(\`初始化：源节点 \${sourceId} 距离设为 0，其他节点设为 ∞\`, {
    currentNode: sourceId,
    visitedNodes: []
  });

  const unvisited = graph.nodes.map(n => n.id);

  while (unvisited.length > 0) {
    let minDist = Infinity;
    let current = null;
    for (const nodeId of unvisited) {
      if (distances[nodeId] < minDist) {
        minDist = distances[nodeId];
        current = nodeId;
      }
    }

    if (current === null || distances[current] === Infinity) {
      break;
    }

    const idx = unvisited.indexOf(current);
    unvisited.splice(idx, 1);
    visited.add(current);

    if (current !== sourceId && current !== targetId) {
      nodeStates[current] = 'settled';
    }

    addFrame(\`选择距离最小的节点 \${current}（距离=\${distances[current]}）\`, {
      currentNode: current,
      visitedNodes: Array.from(visited)
    });

    if (targetId && current === targetId) {
      addFrame(\`到达目标节点 \${targetId}，算法结束\`, {
        currentNode: current,
        visitedNodes: Array.from(visited)
      });
      break;
    }

    const neighbors = edgeMap.get(current) || [];
    for (const edge of neighbors) {
      const next = edge.to;
      if (visited.has(next)) continue;

      edgeStates[edge.id] = 'relaxing';
      
      const newDist = distances[current] + edge.weight;
      
      addFrame(\`检查边 \${current}→\${next}（权重=\${edge.weight}）：新距离 \${distances[current]} + \${edge.weight} = \${newDist}\`, {
        currentNode: current,
        relaxingEdge: edge.id,
        visitedNodes: Array.from(visited)
      });

      if (newDist < distances[next]) {
        distances[next] = newDist;
        previous[next] = current;
        
        addFrame(\`更新节点 \${next} 的距离为 \${newDist}\`, {
          currentNode: current,
          updatedNode: next,
          newDistance: newDist,
          visitedNodes: Array.from(visited)
        });
      }

      if (edgeStates[edge.id] === 'relaxing') {
        if (previous[next] === current) {
          edgeStates[edge.id] = 'in-tree';
        } else {
          edgeStates[edge.id] = 'default';
        }
      }
    }
  }

  let path = [];
  let pathEdges = [];
  if (targetId && distances[targetId] !== Infinity) {
    let current = targetId;
    while (current) {
      path.unshift(current);
      const prev = previous[current];
      if (prev) {
        const edge = graph.edges.find(e => 
          (e.from === prev && e.to === current) || 
          (e.to === prev && e.from === current)
        );
        if (edge) {
          pathEdges.unshift(edge.id);
          edgeStates[edge.id] = 'in-path';
        }
      }
      current = prev;
    }

    path.forEach(nodeId => {
      if (nodeId !== sourceId && nodeId !== targetId) {
        nodeStates[nodeId] = 'in-path';
      }
    });

    addFrame(\`最短路径：\${path.join(' → ')}，总距离：\${distances[targetId]}\`, {
      path: path,
      pathEdges: pathEdges,
      totalDistance: distances[targetId],
      visitedNodes: Array.from(visited)
    });
  } else if (targetId) {
    addFrame(\`无法到达目标节点 \${targetId}\`, {
      visitedNodes: Array.from(visited),
      reachable: false
    });
  }

  return frames;
}`;

@Injectable({ providedIn: 'root' })
export class ScriptExecutorService {
  private exampleScripts: ExampleScript[] = [
    {
      id: 'bfs',
      name: 'BFS 广度优先遍历',
      description: '逐层访问节点，展示队列的使用',
      code: BFS_EXAMPLE,
    },
    {
      id: 'dfs',
      name: 'DFS 深度优先遍历',
      description: '深度优先搜索，回溯时节点变色',
      code: DFS_EXAMPLE,
    },
    {
      id: 'shortest-path',
      name: '简化版最短路径',
      description: '类似 Dijkstra 的最短路径算法，带路径高亮',
      code: SHORTEST_PATH_EXAMPLE,
    },
  ];

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  getExamples(): ExampleScript[] {
    return this.exampleScripts;
  }

  getExampleById(id: string): ExampleScript | undefined {
    return this.exampleScripts.find((e) => e.id === id);
  }

  getDefaultTemplate(): string {
    return `function myAlgorithm(graph, sourceId, targetId) {
  const frames = [];
  let frameIndex = 0;

  const nodeStates = {};
  const edgeStates = {};

  graph.nodes.forEach(node => {
    nodeStates[node.id] = 'default';
  });
  graph.edges.forEach(edge => {
    edgeStates[edge.id] = 'default';
  });

  if (sourceId) nodeStates[sourceId] = 'source';
  if (targetId) nodeStates[targetId] = 'target';

  const addFrame = (description, data = {}) => {
    frames.push({
      index: frameIndex++,
      description,
      highlight: {
        nodeStates: { ...nodeStates },
        edgeStates: { ...edgeStates }
      },
      data
    });
  };

  addFrame('算法开始', { step: 'init' });

  // TODO: 在这里编写你的算法逻辑
  // graph.nodes - 节点数组，每个节点有 id, label 属性
  // graph.edges - 边数组，每条边有 id, from, to, weight, capacity 属性
  // sourceId - 源节点ID
  // targetId - 目标节点ID（可能为 undefined）

  // 节点颜色状态: 'default', 'source', 'target', 'visiting', 'visited', 'settled', 'in-path'
  // 边颜色状态: 'default', 'relaxing', 'in-tree', 'in-path', 'augmenting', 'residual', 'saturated'

  addFrame('算法结束', { step: 'done' });

  return frames;
}`;
  }

  executeScript(
    code: string,
    graph: GraphData,
    sourceId: string | null,
    targetId: string | null
  ): { frames: AnimationFrame[]; error?: ScriptError } {
    const result = this.executeScriptDebug(code, graph, sourceId, targetId);
    return {
      frames: result.frames as AnimationFrame[],
      error: result.error,
    };
  }

  executeScriptDebug(
    code: string,
    graph: GraphData,
    sourceId: string | null,
    targetId: string | null
  ): DebugExecutionResult {
    const startTime = Date.now();
    let timedOut = false;

    try {
      const sandboxGraph = {
        nodes: graph.nodes.map((n) => ({ id: n.id, label: n.label })),
        edges: graph.edges.map((e) => ({
          id: e.id,
          from: e.from,
          to: e.to,
          weight: e.weight,
          capacity: e.capacity,
        })),
      };

      const instrumentedCode = this.instrumentCode(code);

      const func = new Function(
        'graph',
        'sourceId',
        'targetId',
        '__startTime__',
        '__timeoutMs__',
        `${instrumentedCode}; return myAlgorithm(graph, sourceId, targetId, __startTime__, __timeoutMs__);`
      );

      let result: any;
      try {
        result = func(
          sandboxGraph,
          sourceId || undefined,
          targetId || undefined,
          startTime,
          EXECUTION_TIMEOUT_MS
        );
      } catch (e: any) {
        if (e.message && e.message.includes('__TIMEOUT__')) {
          timedOut = true;
          return {
            frames: e.__frames__ || [],
            timedOut: true,
            executionTime: Date.now() - startTime,
          };
        }
        throw e;
      }

      if (!Array.isArray(result)) {
        return {
          frames: [],
          error: { message: '函数必须返回一个数组' },
          executionTime: Date.now() - startTime,
        };
      }

      const frames: DebugFrame[] = result.map((frame: any, index: number) => ({
        ...frame,
        index,
        __debugLine__: frame.__debugLine__ ?? 0,
        __debugVars__: frame.__debugVars__ ?? {},
        __debugTimestamp__: frame.__debugTimestamp__ ?? startTime,
      }));

      return {
        frames,
        executionTime: Date.now() - startTime,
      };
    } catch (e: any) {
      const error: ScriptError = {
        message: e.message || '未知错误',
      };

      if (e.stack) {
        const match = e.stack.match(/<anonymous>:(\d+):(\d+)/);
        if (match) {
          error.lineNumber = parseInt(match[1], 10);
          error.columnNumber = parseInt(match[2], 10);
        }
      }

      return {
        frames: [],
        error,
        timedOut,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private instrumentCode(code: string): string {
    const lines = code.split('\n');
    const resultLines: string[] = [];
    const declaredVars = new Set<string>();

    const addFrameStartRegex = /addFrame\s*\(/;

    let inAddFrameCall = false;
    let parenDepth = 0;
    let addFrameStartLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      const varMatches = line.matchAll(/\b(?:let|const|var)\s+([a-zA-Z_$][\w$]*)/g);
      for (const match of varMatches) {
        declaredVars.add(match[1]);
      }

      if (!inAddFrameCall && addFrameStartRegex.test(line)) {
        inAddFrameCall = true;
        addFrameStartLine = i;
        parenDepth = 0;

        const varsCode = this.buildVarsCaptureCode(declaredVars);
        const indent = line.match(/^\s*/)?.[0] || '';

        resultLines.push(`${indent}var __lineNum__ = ${lineNum};`);
        resultLines.push(`${indent}var __varsSnapshot__ = ${varsCode};`);
        resultLines.push(`${indent}var __ts__ = Date.now();`);
        resultLines.push(`${indent}var __timeoutCheck__ = Date.now() - __startTime__ > __timeoutMs__;`);
        resultLines.push(`${indent}if (__timeoutCheck__) {`);
        resultLines.push(`${indent}  var __e__ = new Error('__TIMEOUT__');`);
        resultLines.push(`${indent}  __e__.__frames__ = frames;`);
        resultLines.push(`${indent}  throw __e__;`);
        resultLines.push(`${indent}}`);
        resultLines.push(`${indent}var __prevFrameCount__ = frames.length;`);
      }

      if (inAddFrameCall) {
        for (const ch of line) {
          if (ch === '(') parenDepth++;
          else if (ch === ')') {
            parenDepth--;
            if (parenDepth <= 0) {
              inAddFrameCall = false;
              break;
            }
          }
        }
      }

      resultLines.push(line);

      if (addFrameStartLine >= 0 && !inAddFrameCall && parenDepth <= 0) {
        const indent = lines[addFrameStartLine].match(/^\s*/)?.[0] || '';
        resultLines.push(`${indent}if (frames.length > __prevFrameCount__) {`);
        resultLines.push(`${indent}  var __lastFrame__ = frames[frames.length - 1];`);
        resultLines.push(`${indent}  __lastFrame__.__debugLine__ = __lineNum__;`);
        resultLines.push(`${indent}  __lastFrame__.__debugVars__ = __varsSnapshot__;`);
        resultLines.push(`${indent}  __lastFrame__.__debugTimestamp__ = __ts__;`);
        resultLines.push(`${indent}}`);
        addFrameStartLine = -1;
        parenDepth = 0;
      }
    }

    return resultLines.join('\n');
  }

  private buildVarsCaptureCode(varNames: Set<string>): string {
    const filtered = Array.from(varNames).filter(
      (v) => !['frames', 'frameIndex', 'addFrame', '__lineNum__', '__varsSnapshot__', '__ts__', '__timeoutCheck__'].includes(v)
    );

    if (filtered.length === 0) {
      return '{}';
    }

    const props = filtered.map((v) => {
      const safeValue = `typeof ${v} !== 'undefined' ? ${v} : undefined`;
      return `${v}: ${safeValue}`;
    });

    return `(function(){ try { return { ${props.join(', ')} }; } catch(e) { return {}; } })()`;
  }

  validateFrames(frames: any[]): ValidationResult {
    const errors: { frameIndex: number; field: string; message: string }[] = [];

    if (!Array.isArray(frames)) {
      return {
        valid: false,
        errors: [{ frameIndex: -1, field: 'root', message: '返回值必须是数组' }],
      };
    }

    frames.forEach((frame, index) => {
      if (!frame || typeof frame !== 'object') {
        errors.push({
          frameIndex: index,
          field: 'frame',
          message: '帧必须是对象',
        });
        return;
      }

      if (!frame.highlight || typeof frame.highlight !== 'object') {
        errors.push({
          frameIndex: index,
          field: 'highlight',
          message: '缺少 highlight 字段或不是对象',
        });
      } else {
        if (!frame.highlight.nodeStates || typeof frame.highlight.nodeStates !== 'object') {
          errors.push({
            frameIndex: index,
            field: 'highlight.nodeStates',
            message: '缺少 nodeStates 字段或不是对象',
          });
        }
        if (!frame.highlight.edgeStates || typeof frame.highlight.edgeStates !== 'object') {
          errors.push({
            frameIndex: index,
            field: 'highlight.edgeStates',
            message: '缺少 edgeStates 字段或不是对象',
          });
        }
      }

      if (frame.description === undefined || frame.description === null) {
        errors.push({
          frameIndex: index,
          field: 'description',
          message: '缺少 description 字段',
        });
      } else if (typeof frame.description !== 'string') {
        errors.push({
          frameIndex: index,
          field: 'description',
          message: 'description 必须是字符串',
        });
      }

      if (frame.data !== undefined && frame.data !== null && typeof frame.data !== 'object') {
        errors.push({
          frameIndex: index,
          field: 'data',
          message: 'data 必须是对象',
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  getSavedScripts(): SavedScript[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as SavedScript[];
      }
    } catch {
      console.warn('Failed to load saved scripts from localStorage');
    }
    return [];
  }

  saveScript(name: string, code: string): SavedScript | null {
    if (!isPlatformBrowser(this.platformId)) return null;

    const scripts = this.getSavedScripts();

    if (scripts.length >= MAX_SAVED_SCRIPTS) {
      return null;
    }

    const newScript: SavedScript = {
      id: `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      code,
      createdAt: Date.now(),
    };

    scripts.unshift(newScript);
    this.saveToStorage(scripts);
    return newScript;
  }

  deleteScript(id: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const scripts = this.getSavedScripts().filter((s) => s.id !== id);
    this.saveToStorage(scripts);
    this.deleteBreakpoints(id);
  }

  updateScript(id: string, name: string, code: string): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    const scripts = this.getSavedScripts();
    const index = scripts.findIndex((s) => s.id === id);
    if (index === -1) return false;

    scripts[index] = {
      ...scripts[index],
      name,
      code,
    };
    this.saveToStorage(scripts);
    return true;
  }

  getScriptById(id: string): SavedScript | undefined {
    return this.getSavedScripts().find((s) => s.id === id);
  }

  private saveToStorage(scripts: SavedScript[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
    } catch {
      console.warn('Failed to save scripts to localStorage');
    }
  }

  getMaxSavedScripts(): number {
    return MAX_SAVED_SCRIPTS;
  }

  getBreakpoints(scriptId: string): number[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      const stored = localStorage.getItem(BREAKPOINTS_STORAGE_KEY);
      if (stored) {
        const allBreakpoints = JSON.parse(stored) as Record<string, number[]>;
        return allBreakpoints[scriptId] || [];
      }
    } catch {
      console.warn('Failed to load breakpoints from localStorage');
    }
    return [];
  }

  saveBreakpoints(scriptId: string, breakpoints: number[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const stored = localStorage.getItem(BREAKPOINTS_STORAGE_KEY);
      const allBreakpoints = stored ? JSON.parse(stored) : {};
      allBreakpoints[scriptId] = breakpoints;
      localStorage.setItem(BREAKPOINTS_STORAGE_KEY, JSON.stringify(allBreakpoints));
    } catch {
      console.warn('Failed to save breakpoints to localStorage');
    }
  }

  deleteBreakpoints(scriptId: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const stored = localStorage.getItem(BREAKPOINTS_STORAGE_KEY);
      if (stored) {
        const allBreakpoints = JSON.parse(stored) as Record<string, number[]>;
        delete allBreakpoints[scriptId];
        localStorage.setItem(BREAKPOINTS_STORAGE_KEY, JSON.stringify(allBreakpoints));
      }
    } catch {
      console.warn('Failed to delete breakpoints from localStorage');
    }
  }

  getDefaultBreakpointsKey(): string {
    return '__default_script__';
  }

  buildAlgorithmResult(frames: AnimationFrame[], scriptName: string): AlgorithmResult {
    return {
      frames,
      summary: {
        type: 'custom',
        value: frames.length,
        path: undefined,
      },
    };
  }

  getTimeoutMs(): number {
    return EXECUTION_TIMEOUT_MS;
  }

  deepCloneVariables(obj: any, maxDepth: number = 2): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (maxDepth <= 0) {
      if (Array.isArray(obj)) {
        return `[${obj.length} 项]`;
      }
      if (obj instanceof Set) {
        return `Set(${obj.size})`;
      }
      if (obj instanceof Map) {
        return `Map(${obj.size})`;
      }
      return '{...}';
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepCloneVariables(item, maxDepth - 1));
    }

    if (obj instanceof Set) {
      return {
        __type__: 'Set',
        values: Array.from(obj).map((item) => this.deepCloneVariables(item, maxDepth - 1)),
      };
    }

    if (obj instanceof Map) {
      const entries: Array<{ key: any; value: any }> = [];
      obj.forEach((value, key) => {
        entries.push({
          key: this.deepCloneVariables(key, maxDepth - 1),
          value: this.deepCloneVariables(value, maxDepth - 1),
        });
      });
      return {
        __type__: 'Map',
        entries,
      };
    }

    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      try {
        result[key] = this.deepCloneVariables(obj[key], maxDepth - 1);
      } catch {
        result[key] = '[无法访问]';
      }
    }
    return result;
  }

  formatVariableValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'function') return 'ƒ function()';
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (value instanceof Set) return `Set(${value.size})`;
    if (value instanceof Map) return `Map(${value.size})`;
    if (typeof value === 'object') {
      if (value.__type__ === 'Set') return `Set(${value.values?.length || 0})`;
      if (value.__type__ === 'Map') return `Map(${value.entries?.length || 0})`;
      const keys = Object.keys(value);
      return `{${keys.length} 个字段}`;
    }
    return String(value);
  }
}
