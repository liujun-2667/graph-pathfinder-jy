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

const STORAGE_KEY = 'graph-custom-scripts';
const MAX_SAVED_SCRIPTS = 10;

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
  // graph.edges - 边数组，每条边有 from, to, weight, capacity 属性
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
    try {
      const sandboxGraph = {
        nodes: graph.nodes.map((n) => ({ id: n.id, label: n.label })),
        edges: graph.edges.map((e) => ({
          from: e.from,
          to: e.to,
          weight: e.weight,
          capacity: e.capacity,
        })),
      };

      const func = new Function(
        'graph',
        'sourceId',
        'targetId',
        `${code}; return myAlgorithm(graph, sourceId, targetId);`
      );

      const result = func(sandboxGraph, sourceId || undefined, targetId || undefined);

      if (!Array.isArray(result)) {
        return {
          frames: [],
          error: { message: '函数必须返回一个数组' },
        };
      }

      const frames: AnimationFrame[] = result.map((frame: any, index: number) => ({
        ...frame,
        index,
      }));

      return { frames };
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

      return { frames: [], error };
    }
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
}
