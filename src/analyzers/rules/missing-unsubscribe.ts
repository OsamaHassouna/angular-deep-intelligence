import { AnalysisRule, AnalysisDiagnostic } from '../analyzer.types';
import { AngularFile, ProjectIndex } from '../../scanner/project-model';

/**
 * Rule: missing-unsubscribe
 *
 * Detects .subscribe() calls in components/directives without proper cleanup.
 * Checks for:
 * - ngOnDestroy with .unsubscribe() calls
 * - takeUntil pattern (destroy$ subject)
 * - DestroyRef / takeUntilDestroyed
 * - async pipe usage in linked template (if templateUrl is resolved)
 *
 * Skips:
 * - Services (subscriptions in services are often intentional singletons)
 * - Files using takeUntilDestroyed (Angular 16+ pattern)
 * - Files using async pipe for the observable in question
 */
export const missingUnsubscribeRule: AnalysisRule = {
  id: 'missing-unsubscribe',
  name: 'Missing Unsubscribe',
  description: 'Detects .subscribe() calls without proper cleanup in components/directives',
  severity: 'warning',
  category: 'anti-pattern',

  analyze(file: AngularFile, index: ProjectIndex): AnalysisDiagnostic[] {
    // Only check components and directives
    if (file.artifactType !== 'component' && file.artifactType !== 'directive') {
      return [];
    }

    if (file.extension !== '.ts') {
      return [];
    }

    const content = file.content;
    const diagnostics: AnalysisDiagnostic[] = [];

    // Find all .subscribe() calls
    const subscribeRegex = /\.subscribe\s*\(/g;
    let match: RegExpExecArray | null;
    const subscribeLocations: number[] = [];

    while ((match = subscribeRegex.exec(content)) !== null) {
      subscribeLocations.push(match.index);
    }

    if (subscribeLocations.length === 0) {
      return [];
    }

    // Check for proper cleanup patterns
    const hasNgOnDestroy = /ngOnDestroy\s*\(/.test(content);
    const hasUnsubscribe = /\.unsubscribe\s*\(/.test(content);
    const hasTakeUntil = /takeUntil\s*\(/.test(content);
    const hasTakeUntilDestroyed = /takeUntilDestroyed/.test(content);
    const hasDestroyRef = /DestroyRef/.test(content);
    const hasAsyncPipe = checkLinkedTemplateForAsyncPipe(file, index);

    // If any global cleanup pattern exists, skip all
    if (hasTakeUntilDestroyed || hasDestroyRef) {
      return [];
    }

    if (hasNgOnDestroy && (hasUnsubscribe || hasTakeUntil)) {
      return [];
    }

    if (hasAsyncPipe && subscribeLocations.length <= 1) {
      return [];
    }

    // Report each .subscribe() call
    const lines = content.split('\n');
    for (const subIndex of subscribeLocations) {
      const line = getLineNumber(content, subIndex);
      const lineContent = lines[line] || '';

      // Skip if this specific subscribe is piped through takeUntil
      const linesBefore = lines.slice(Math.max(0, line - 3), line + 1).join('\n');
      if (/takeUntil\s*\(/.test(linesBefore)) {
        continue;
      }

      // Skip HTTP calls (typically complete automatically)
      if (/\.get\s*[<(]|\.post\s*[<(]|\.put\s*[<(]|\.delete\s*[<(]|\.patch\s*[<(]/.test(linesBefore)) {
        continue;
      }

      diagnostics.push({
        ruleId: 'missing-unsubscribe',
        message: '.subscribe() without cleanup. Add takeUntilDestroyed(), unsubscribe in ngOnDestroy, or use the async pipe.',
        severity: 'warning',
        category: 'anti-pattern',
        location: {
          file,
          line,
          column: lineContent.indexOf('.subscribe'),
        },
        suggestion: 'Use takeUntilDestroyed() from @angular/core/rxjs-interop (Angular 16+) or implement ngOnDestroy with takeUntil pattern.',
        codeSnippet: lineContent.trim(),
      });
    }

    return diagnostics;
  },
};

function getLineNumber(content: string, index: number): number {
  let line = 0;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === '\n') {
      line++;
    }
  }
  return line;
}

function checkLinkedTemplateForAsyncPipe(file: AngularFile, index: ProjectIndex): boolean {
  if (!file.linkedTemplatePath) {
    return false;
  }

  const templateFile = index.fileMap.get(file.linkedTemplatePath);
  if (!templateFile) {
    return false;
  }

  return templateFile.content.includes('| async');
}
