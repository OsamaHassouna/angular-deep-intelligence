import { AnalysisRule, AnalysisDiagnostic } from '../analyzer.types';
import { AngularFile, ProjectIndex } from '../../scanner/project-model';
import { getConfig } from '../../utils/config';

/**
 * Rule: oversized-component
 *
 * Detects components that exceed a configurable line threshold (default: 300).
 * Suggests splitting based on analysis of the component structure.
 *
 * Heuristic for split candidates:
 * - Multiple methods that could be separate concerns
 * - Multiple template sections (if inline template)
 * - Large constructor indicating too many dependencies
 */
export const oversizedComponentRule: AnalysisRule = {
  id: 'oversized-component',
  name: 'Oversized Component',
  description: 'Detect components exceeding line threshold',
  severity: 'warning',
  category: 'anti-pattern',

  analyze(file: AngularFile, _index: ProjectIndex): AnalysisDiagnostic[] {
    if (file.artifactType !== 'component' || file.extension !== '.ts') {
      return [];
    }

    const config = getConfig();
    const threshold = config.oversizedThreshold;

    if (file.lineCount <= threshold) {
      return [];
    }

    const content = file.content;
    const splitSuggestions = analyzeSplitCandidates(content);

    const message = `Component has ${file.lineCount} lines (threshold: ${threshold}). Consider splitting.`;
    const suggestion = splitSuggestions.length > 0
      ? `Potential split candidates:\n${splitSuggestions.map(s => `- ${s}`).join('\n')}`
      : 'Consider extracting related methods and their dependencies into child components or services.';

    return [{
      ruleId: 'oversized-component',
      message,
      severity: 'warning',
      category: 'anti-pattern',
      location: {
        file,
        line: 0,
        column: 0,
      },
      suggestion,
    }];
  },
};

interface MethodInfo {
  name: string;
  lineCount: number;
  startLine: number;
}

function analyzeSplitCandidates(content: string): string[] {
  const suggestions: string[] = [];
  const lines = content.split('\n');

  // Count methods and their sizes
  const methods = extractMethods(lines);
  const largeMethods = methods.filter(m => m.lineCount > 30);

  if (largeMethods.length > 0) {
    for (const method of largeMethods.slice(0, 3)) {
      suggestions.push(`Method '${method.name}' (${method.lineCount} lines) could be extracted to a service`);
    }
  }

  // Check constructor parameter count (too many deps = too many concerns)
  const ctorMatch = content.match(/constructor\s*\(([\s\S]*?)\)/);
  if (ctorMatch) {
    const params = ctorMatch[1].split(',').filter(p => p.trim().length > 0);
    if (params.length > 6) {
      suggestions.push(`Constructor has ${params.length} dependencies - consider splitting responsibilities`);
    }
  }

  // Count distinct event handler patterns (onClick, onSubmit, etc.)
  const handlers = lines.filter(l => /^\s+(on[A-Z]\w+)\s*\(/.test(l));
  if (handlers.length > 5) {
    suggestions.push(`${handlers.length} event handlers suggest multiple UI concerns in one component`);
  }

  return suggestions;
}

function extractMethods(lines: string[]): MethodInfo[] {
  const methods: MethodInfo[] = [];
  const methodRegex = /^\s+(?:private\s+|public\s+|protected\s+)?(?:async\s+)?(\w+)\s*\(/;

  let currentMethod: MethodInfo | null = null;
  let braceDepth = 0;
  let inMethod = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inMethod) {
      const match = line.match(methodRegex);
      if (match && !['constructor', 'ngOnInit', 'ngOnDestroy', 'ngOnChanges', 'ngAfterViewInit'].includes(match[1])) {
        currentMethod = { name: match[1], lineCount: 0, startLine: i };
        inMethod = true;
        braceDepth = 0;
      }
    }

    if (inMethod && currentMethod) {
      currentMethod.lineCount++;
      for (const char of line) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
      }

      if (braceDepth <= 0 && currentMethod.lineCount > 1) {
        methods.push(currentMethod);
        currentMethod = null;
        inMethod = false;
      }
    }
  }

  return methods;
}
