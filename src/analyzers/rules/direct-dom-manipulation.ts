import { AnalysisRule, AnalysisDiagnostic } from '../analyzer.types';
import { AngularFile, ProjectIndex } from '../../scanner/project-model';

/**
 * Rule: direct-dom-manipulation
 *
 * Detects direct DOM access in components/directives:
 * - ElementRef.nativeElement usage
 * - document.querySelector / querySelectorAll
 * - document.getElementById
 * - Renderer2 is OK (the Angular way)
 *
 * Direct DOM manipulation breaks SSR, makes testing harder,
 * and bypasses Angular's change detection.
 */
export const directDomManipulationRule: AnalysisRule = {
  id: 'direct-dom-manipulation',
  name: 'Direct DOM Manipulation',
  description: 'Detect direct DOM access bypassing Angular abstractions',
  severity: 'warning',
  category: 'anti-pattern',

  analyze(file: AngularFile, _index: ProjectIndex): AnalysisDiagnostic[] {
    if (file.artifactType !== 'component' && file.artifactType !== 'directive') {
      return [];
    }
    if (file.extension !== '.ts') {
      return [];
    }

    const content = file.content;
    const lines = content.split('\n');
    const diagnostics: AnalysisDiagnostic[] = [];

    const patterns: Array<{ regex: RegExp; message: string; suggestion: string }> = [
      {
        regex: /\.nativeElement/,
        message: 'Direct DOM access via ElementRef.nativeElement. This breaks SSR and bypasses Angular abstractions.',
        suggestion: 'Use Renderer2 for DOM manipulation, or @ViewChild with template references. For styling, use @HostBinding or ngClass/ngStyle.',
      },
      {
        regex: /document\.querySelector/,
        message: 'document.querySelector used directly. This bypasses Angular and breaks SSR.',
        suggestion: 'Use @ViewChild / @ViewChildren with template references instead.',
      },
      {
        regex: /document\.querySelectorAll/,
        message: 'document.querySelectorAll used directly. This bypasses Angular and breaks SSR.',
        suggestion: 'Use @ViewChildren with template references instead.',
      },
      {
        regex: /document\.getElementById/,
        message: 'document.getElementById used directly. This bypasses Angular and breaks SSR.',
        suggestion: 'Use @ViewChild with a template reference variable instead.',
      },
      {
        regex: /document\.createElement/,
        message: 'document.createElement used directly. This bypasses Angular and breaks SSR.',
        suggestion: 'Prefer Angular component/directive composition. If dynamic DOM is needed, use Renderer2.createElement() with an injected Renderer2.',
      },
      {
        regex: /document\.body/,
        message: 'Direct document.body access. This bypasses Angular and breaks SSR.',
        suggestion: 'Inject DOCUMENT token: constructor(@Inject(DOCUMENT) private document: Document) and use this.document.body instead. This preserves SSR compatibility.',
      },
      {
        regex: /\.innerHTML\s*=/,
        message: 'Direct innerHTML assignment. This bypasses Angular sanitization and risks XSS.',
        suggestion: 'Use [innerHTML] binding with Angular\'s built-in sanitization, or DomSanitizer for trusted content.',
      },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match) {
          diagnostics.push({
            ruleId: 'direct-dom-manipulation',
            message: pattern.message,
            severity: 'warning',
            category: 'anti-pattern',
            location: {
              file,
              line: i,
              column: match.index ?? 0,
            },
            suggestion: pattern.suggestion,
            codeSnippet: trimmed,
          });
        }
      }
    }

    return diagnostics;
  },
};
