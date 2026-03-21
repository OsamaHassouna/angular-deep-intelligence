import { AnalysisRule, AnalysisDiagnostic } from '../analyzer.types';
import { AngularFile, ProjectIndex } from '../../scanner/project-model';

/**
 * Rule: circular-service-deps
 *
 * Detects circular dependency chains between services by analyzing
 * constructor injection patterns. Circular deps cause runtime errors
 * and indicate tangled architecture.
 *
 * Approach: For each service, extract constructor-injected services
 * from the file content. Then walk the dependency graph looking for
 * cycles. Reports on the file that closes the loop.
 */

interface ServiceDeps {
  file: AngularFile;
  injectedServices: string[];
}

export const circularServiceDepsRule: AnalysisRule = {
  id: 'circular-service-deps',
  name: 'Circular Service Dependencies',
  description: 'Detect circular dependency chains between Angular services',
  severity: 'warning',
  category: 'architecture',

  analyze(file: AngularFile, index: ProjectIndex): AnalysisDiagnostic[] {
    // Only run once per scan: process on the first service file
    if (file.artifactType !== 'service' || file.extension !== '.ts') {
      return [];
    }

    // Only run analysis from the first service (to avoid duplicate work)
    const services = index.files.filter(f => f.artifactType === 'service' && f.extension === '.ts');
    if (services.length === 0 || services[0].relativePath !== file.relativePath) {
      return [];
    }

    // Build dependency map: serviceName -> injected service names
    const depMap = new Map<string, ServiceDeps>();

    for (const svc of services) {
      const name = extractServiceName(svc.content);
      if (!name) continue;

      const injected = extractInjectedServices(svc.content);
      depMap.set(name, { file: svc, injectedServices: injected });
    }

    // Detect cycles
    const diagnostics: AnalysisDiagnostic[] = [];
    const visited = new Set<string>();
    const reported = new Set<string>();

    for (const [name] of depMap) {
      if (visited.has(name)) continue;
      const chain: string[] = [];
      detectCycle(name, chain, visited, depMap, diagnostics, reported);
    }

    return diagnostics;
  },
};

function extractServiceName(content: string): string | null {
  // Match: export class SomeService or @Injectable() ... class SomeService
  const match = content.match(/export\s+class\s+(\w+Service\w*)/);
  return match ? match[1] : null;
}

function extractInjectedServices(content: string): string[] {
  const services: string[] = [];
  let match;

  // Match constructor parameters: constructor(private someService: SomeService, ...)
  const ctorMatch = content.match(/constructor\s*\(([\s\S]*?)\)/);
  if (ctorMatch) {
    const params = ctorMatch[1];
    const paramRegex = /(?:private|protected|public|readonly)\s+\w+\s*:\s*(\w+Service\w*)/g;
    while ((match = paramRegex.exec(params)) !== null) {
      services.push(match[1]);
    }
  }

  // Also match inject() pattern: private x = inject(SomeService)
  const injectRegex = /inject\(\s*(\w+Service\w*)\s*\)/g;
  while ((match = injectRegex.exec(content)) !== null) {
    services.push(match[1]);
  }

  return services;
}

function detectCycle(
  current: string,
  chain: string[],
  visited: Set<string>,
  depMap: Map<string, ServiceDeps>,
  diagnostics: AnalysisDiagnostic[],
  reported: Set<string>,
): void {
  const chainIndex = chain.indexOf(current);
  if (chainIndex >= 0) {
    // Found a cycle
    const cycle = chain.slice(chainIndex);
    cycle.push(current);
    const cycleKey = [...cycle].sort().join(',');

    if (!reported.has(cycleKey)) {
      reported.add(cycleKey);

      // Report on the file that closes the loop
      const deps = depMap.get(current);
      if (deps) {
        const ctorLine = findConstructorLine(deps.file.content);
        diagnostics.push({
          ruleId: 'circular-service-deps',
          message: `Circular dependency chain: ${cycle.join(' -> ')}`,
          severity: 'warning',
          category: 'architecture',
          location: {
            file: deps.file,
            line: ctorLine,
            column: 0,
          },
          suggestion: `Break the cycle by extracting shared logic into a new service, using an event bus, or restructuring the dependency flow.`,
        });
      }
    }
    return;
  }

  const deps = depMap.get(current);
  if (!deps) return;

  chain.push(current);
  visited.add(current);

  for (const injected of deps.injectedServices) {
    detectCycle(injected, chain, visited, depMap, diagnostics, reported);
  }

  chain.pop();
}

function findConstructorLine(content: string): number {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('constructor(') || lines[i].includes('constructor (')) {
      return i;
    }
  }
  return 0;
}
