import { ProjectIndex, AngularFile } from '../scanner/project-model';

export interface GraphNode {
  id: string;
  label: string;
  type: 'component' | 'service' | 'directive' | 'pipe' | 'module';
  filePath: string;
  fileUri: string;
  lineCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  isCircular: boolean;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  circularChains: string[][];
}

/**
 * Extracts a dependency graph from the project index.
 * Analyzes constructor injection and inject() calls to build
 * component -> service and service -> service relationships.
 */
export function extractDependencyGraph(index: ProjectIndex): DependencyGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<string, GraphNode>();

  // Collect all injectable artifacts (services, components, directives, pipes, modules)
  const injectables = index.files.filter(
    f => f.extension === '.ts' && ['component', 'service', 'directive', 'pipe', 'module'].includes(f.artifactType)
  );

  // Build className -> file mapping
  const classToFile = new Map<string, AngularFile>();
  const fileToClass = new Map<string, string>();

  for (const file of injectables) {
    const className = extractClassName(file.content, file.artifactType);
    if (!className) continue;

    classToFile.set(className, file);
    fileToClass.set(file.relativePath, className);

    const node: GraphNode = {
      id: className,
      label: className,
      type: file.artifactType as GraphNode['type'],
      filePath: file.relativePath,
      fileUri: file.uri,
      lineCount: file.lineCount,
    };
    nodes.push(node);
    nodeMap.set(className, node);
  }

  // Extract dependency edges
  for (const file of injectables) {
    const sourceClass = fileToClass.get(file.relativePath);
    if (!sourceClass) continue;

    const injected = extractInjectedDeps(file.content);
    for (const dep of injected) {
      // Only add edge if target exists in our graph
      if (nodeMap.has(dep) && dep !== sourceClass) {
        edges.push({
          source: sourceClass,
          target: dep,
          isCircular: false, // will be marked later
        });
      }
    }
  }

  // Detect circular chains and mark edges
  const circularChains = detectCircularChains(nodes, edges);

  // Mark circular edges
  const circularPairs = new Set<string>();
  for (const chain of circularChains) {
    for (let i = 0; i < chain.length - 1; i++) {
      circularPairs.add(`${chain[i]}->${chain[i + 1]}`);
    }
  }
  for (const edge of edges) {
    if (circularPairs.has(`${edge.source}->${edge.target}`)) {
      edge.isCircular = true;
    }
  }

  return { nodes, edges, circularChains };
}

function extractClassName(content: string, artifactType: string): string | null {
  // Match exported class name based on artifact type
  const suffixPatterns: Record<string, RegExp> = {
    service: /export\s+class\s+(\w+)/,
    component: /export\s+class\s+(\w+)/,
    directive: /export\s+class\s+(\w+)/,
    pipe: /export\s+class\s+(\w+)/,
    module: /export\s+class\s+(\w+)/,
  };

  const pattern = suffixPatterns[artifactType];
  if (!pattern) return null;

  const match = content.match(pattern);
  return match ? match[1] : null;
}

function extractInjectedDeps(content: string): string[] {
  const deps: string[] = [];
  let match;

  // Constructor injection: constructor(private foo: FooService, ...)
  const ctorMatch = content.match(/constructor\s*\(([\s\S]*?)\)/);
  if (ctorMatch) {
    const params = ctorMatch[1];
    const paramRegex = /(?:private|protected|public|readonly)\s+\w+\s*:\s*(\w+)/g;
    while ((match = paramRegex.exec(params)) !== null) {
      deps.push(match[1]);
    }
  }

  // inject() pattern: inject(SomeService)
  const injectRegex = /inject\(\s*(\w+)\s*\)/g;
  while ((match = injectRegex.exec(content)) !== null) {
    deps.push(match[1]);
  }

  return deps;
}

function detectCircularChains(nodes: GraphNode[], edges: GraphEdge[]): string[][] {
  const adjList = new Map<string, string[]>();
  for (const node of nodes) {
    adjList.set(node.id, []);
  }
  for (const edge of edges) {
    adjList.get(edge.source)?.push(edge.target);
  }

  const chains: string[][] = [];
  const visited = new Set<string>();
  const reported = new Set<string>();

  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const path: string[] = [];
    dfs(node.id, path, visited, adjList, chains, reported);
  }

  return chains;
}

function dfs(
  current: string,
  path: string[],
  visited: Set<string>,
  adjList: Map<string, string[]>,
  chains: string[][],
  reported: Set<string>,
): void {
  const idx = path.indexOf(current);
  if (idx >= 0) {
    const cycle = path.slice(idx);
    cycle.push(current);
    const key = [...cycle].sort().join(',');
    if (!reported.has(key)) {
      reported.add(key);
      chains.push(cycle);
    }
    return;
  }

  const neighbors = adjList.get(current);
  if (!neighbors) return;

  path.push(current);
  visited.add(current);

  for (const neighbor of neighbors) {
    dfs(neighbor, path, visited, adjList, chains, reported);
  }

  path.pop();
}
