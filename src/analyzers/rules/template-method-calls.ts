import { AnalysisRule, AnalysisDiagnostic } from '../analyzer.types';
import { AngularFile, ProjectIndex } from '../../scanner/project-model';

/**
 * Rule: template-method-calls
 *
 * Detects method calls in Angular templates that execute on every change detection cycle:
 * - {{ method() }} interpolation
 * - [prop]="method()" property binding
 * - *ngFor="let x of method()" structural directive
 * - *ngIf="method()" structural directive
 *
 * These cause performance issues because they run on every CD cycle.
 * Exception: known safe patterns like trackBy functions.
 */
export const templateMethodCallsRule: AnalysisRule = {
  id: 'template-method-calls',
  name: 'Template Method Calls',
  description: 'Detect method calls in templates that run every change detection cycle',
  severity: 'hint',
  category: 'performance',

  analyze(file: AngularFile, index: ProjectIndex): AnalysisDiagnostic[] {
    // Get the template content
    let templateContent: string | null = null;
    let templateFile: AngularFile | null = null;

    if (file.artifactType === 'template') {
      templateContent = file.content;
      templateFile = file;
    } else if (file.artifactType === 'component' && file.extension === '.ts') {
      // Check linked external template
      if (file.linkedTemplatePath) {
        const linked = index.fileMap.get(file.linkedTemplatePath);
        if (linked) {
          templateContent = linked.content;
          templateFile = linked;
        }
      } else {
        // Extract inline template
        const inlineMatch = file.content.match(/template\s*:\s*`([\s\S]*?)`/);
        if (inlineMatch) {
          templateContent = inlineMatch[1];
          templateFile = file;
        }
      }
    }

    if (!templateContent || !templateFile) {
      return [];
    }

    // Only analyze once per template (skip if we're analyzing the component and template is external)
    if (file.artifactType === 'template') {
      return [];
    }

    const lines = templateContent.split('\n');
    const diagnostics: AnalysisDiagnostic[] = [];

    // Patterns to detect method calls in templates
    const patterns: Array<{ regex: RegExp; contextName: string }> = [
      // {{ method() }} or {{ obj.method() }}
      { regex: /\{\{\s*[^}]*\b(\w+)\s*\([^)]*\)\s*[^}]*\}\}/, contextName: 'interpolation' },
      // [property]="method()" or [property]="obj.method()"
      { regex: /\[[\w.]+\]\s*=\s*"[^"]*\b(\w+)\s*\([^)]*\)[^"]*"/, contextName: 'property binding' },
      // *ngIf="method()" or *ngIf="!method()"
      { regex: /\*ngIf\s*=\s*"[^"]*\b(\w+)\s*\([^)]*\)[^"]*"/, contextName: '*ngIf' },
      // *ngFor="let x of method()"
      { regex: /\*ngFor\s*=\s*"[^"]*\bof\s+(\w+)\s*\([^)]*\)[^"]*"/, contextName: '*ngFor' },
    ];

    // Known safe patterns to skip
    const safePatterns = [
      /trackBy\s*:\s*\w+/,  // trackBy functions are intentional
      /\|\s*async/,          // async pipe handles its own subscription
      /\|\s*\w+/,            // pipe transforms are cached by Angular
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip HTML comments
      if (line.trim().startsWith('<!--')) {
        continue;
      }

      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (!match) continue;

        const methodName = match[1];

        // Skip safe patterns on this line
        if (safePatterns.some(safe => safe.test(line))) {
          continue;
        }

        // Skip common Angular built-in method-like patterns
        if (['$any', 'toString', 'valueOf', 'slice'].includes(methodName)) {
          continue;
        }

        diagnostics.push({
          ruleId: 'template-method-calls',
          message: `Method call '${methodName}()' in ${pattern.contextName} runs on every change detection cycle.`,
          severity: 'hint',
          category: 'performance',
          location: {
            file: templateFile,
            line: i,
            column: match.index ?? 0,
          },
          suggestion: `Replace with a property/getter backed by a computed value, or use a pure pipe. For OnPush components, consider memoization.`,
          codeSnippet: line.trim(),
        });
      }
    }

    return diagnostics;
  },
};
