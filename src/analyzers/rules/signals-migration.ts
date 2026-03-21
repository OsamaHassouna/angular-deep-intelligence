import { AnalysisRule, AnalysisDiagnostic } from '../analyzer.types';
import { AngularFile, ProjectIndex } from '../../scanner/project-model';

/**
 * Rule: signals-migration
 *
 * Detects RxJS patterns that could be replaced with Angular Signals (v16+):
 * - BehaviorSubject with .next() -> signal() with .set() / .update()
 * - combineLatest + map -> computed()
 * - Subject used only for local state -> signal()
 * - Observable property with getValue() -> signal()
 *
 * Reports as 'info' since signals are optional but recommended for new code.
 */
export const signalsMigrationRule: AnalysisRule = {
  id: 'signals-migration',
  name: 'Signals Migration',
  description: 'Detect RxJS patterns that could use Angular Signals',
  severity: 'hint',
  category: 'migration',

  analyze(file: AngularFile, _index: ProjectIndex): AnalysisDiagnostic[] {
    if (file.extension !== '.ts') {
      return [];
    }

    // Only analyze components and services
    if (file.artifactType !== 'component' && file.artifactType !== 'service') {
      return [];
    }

    const content = file.content;
    const lines = content.split('\n');
    const diagnostics: AnalysisDiagnostic[] = [];

    // Pattern 1: BehaviorSubject with .next() -> signal()
    const behaviorSubjectPattern = /new\s+BehaviorSubject\s*[<(]/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(behaviorSubjectPattern);
      if (match) {
        // Check if .next() is used (state management pattern)
        const hasNext = content.includes('.next(');
        if (hasNext) {
          diagnostics.push({
            ruleId: 'signals-migration',
            message: 'BehaviorSubject with .next() can be replaced with signal() and .set()/.update().',
            severity: 'hint',
            category: 'migration',
            location: {
              file,
              line: i,
              column: match.index ?? 0,
            },
            suggestion: 'Replace: `private count$ = new BehaviorSubject(0)` with `count = signal(0)`. Replace `.next(val)` with `.set(val)` or `.update(v => v + 1)`. Subscribers become `effect(() => { ... this.count() ... })`.',
            codeSnippet: lines[i].trim(),
          });
        }
      }
    }

    // Pattern 2: combineLatest + map -> computed()
    for (let i = 0; i < lines.length; i++) {
      if (/combineLatest\s*\(/.test(lines[i]) || /combineLatest\s*\[/.test(lines[i])) {
        // Check surrounding lines for .pipe(map(...))
        const nearby = lines.slice(i, Math.min(i + 5, lines.length)).join('\n');
        if (/\.pipe\s*\(\s*map\s*\(/.test(nearby)) {
          diagnostics.push({
            ruleId: 'signals-migration',
            message: 'combineLatest + map pattern can be replaced with computed().',
            severity: 'hint',
            category: 'migration',
            location: {
              file,
              line: i,
              column: 0,
            },
            suggestion: 'Replace: `combineLatest([a$, b$]).pipe(map(([a, b]) => a + b))` with `computed(() => a() + b())`. Simpler, synchronous, and no subscription management needed.',
            codeSnippet: lines[i].trim(),
          });
        }
      }
    }

    // Pattern 3: Subject used as simple event emitter for local state
    for (let i = 0; i < lines.length; i++) {
      const subjectMatch = lines[i].match(/(?:private\s+)?(\w+)\s*=\s*new\s+Subject\s*<([^>]*)>/);
      if (subjectMatch) {
        const varName = subjectMatch[1];
        // Check if this subject is only used with .next() for local state (not piped externally)
        const isExposed = new RegExp(`(?:public|get)\\s+${varName}`).test(content);
        const asObservablePattern = new RegExp(`${varName}\\.asObservable`);
        if (!isExposed && !asObservablePattern.test(content)) {
          diagnostics.push({
            ruleId: 'signals-migration',
            message: `Private Subject '${varName}' used for local state could be a signal().`,
            severity: 'hint',
            category: 'migration',
            location: {
              file,
              line: i,
              column: subjectMatch.index ?? 0,
            },
            suggestion: 'If this Subject is only used internally for state, replace with signal(). Signals are synchronous, simpler, and integrate with Angular change detection.',
          });
        }
      }
    }

    // Pattern 4: .getValue() on BehaviorSubject -> signal().get() or just signal()
    for (let i = 0; i < lines.length; i++) {
      if (/\.getValue\s*\(\s*\)/.test(lines[i])) {
        diagnostics.push({
          ruleId: 'signals-migration',
          message: '.getValue() on BehaviorSubject is a code smell. Signals provide synchronous access by default.',
          severity: 'hint',
          category: 'migration',
          location: {
            file,
            line: i,
            column: lines[i].indexOf('.getValue'),
          },
          suggestion: 'With signals, reading the current value is just `mySignal()` - no need for getValue(). This is both cleaner and reactive.',
        });
      }
    }

    return diagnostics;
  },
};
