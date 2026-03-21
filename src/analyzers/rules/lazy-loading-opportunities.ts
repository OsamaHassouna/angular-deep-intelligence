import { AnalysisRule, AnalysisDiagnostic } from '../analyzer.types';
import { AngularFile, ProjectIndex } from '../../scanner/project-model';

/**
 * Rule: lazy-loading-opportunities
 *
 * Detects NgModules that are eagerly loaded in routing but could
 * be lazy-loaded. Analyzes route configurations for:
 * - Direct component/module references in routes (not loadChildren/loadComponent)
 * - Feature modules imported directly in AppModule/CoreModule
 * - Large eagerly-loaded modules (high declaration count)
 *
 * Lazy loading improves initial load time by splitting the bundle.
 */
export const lazyLoadingOpportunitiesRule: AnalysisRule = {
  id: 'lazy-loading-opportunities',
  name: 'Lazy Loading Opportunities',
  description: 'Detect modules and routes that could benefit from lazy loading',
  severity: 'hint',
  category: 'performance',

  analyze(file: AngularFile, index: ProjectIndex): AnalysisDiagnostic[] {
    if (file.extension !== '.ts') {
      return [];
    }

    const diagnostics: AnalysisDiagnostic[] = [];
    const content = file.content;
    const lines = content.split('\n');

    // Check route files for eager loading
    if (isRoutingFile(file)) {
      diagnostics.push(...detectEagerRoutes(file, lines));
    }

    // Check root/core modules for directly imported feature modules
    if (file.artifactType === 'module' && isRootModule(file)) {
      diagnostics.push(...detectEagerModuleImports(file, lines, index));
    }

    return diagnostics;
  },
};

function isRoutingFile(file: AngularFile): boolean {
  return file.relativePath.includes('routing') ||
    file.relativePath.includes('routes') ||
    file.content.includes('Routes') && file.content.includes('path:');
}

function isRootModule(file: AngularFile): boolean {
  const name = file.relativePath.toLowerCase();
  return name.includes('app.module') ||
    name.includes('app-routing') ||
    name.includes('core.module');
}

function detectEagerRoutes(file: AngularFile, lines: string[]): AnalysisDiagnostic[] {
  const diagnostics: AnalysisDiagnostic[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip comments
    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) {
      continue;
    }

    // Detect: component: SomeComponent in a route definition (not a lazy-loaded one)
    // This is eager loading if the route has a path and is not a redirect
    if (/component\s*:\s*\w+Component/.test(line)) {
      // Check if this route is a child of a lazy-loaded module (look for loadChildren nearby)
      const context = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 5)).join('\n');

      // Skip if this is the root route (path: '') or a redirect
      if (/path\s*:\s*['"]'?['"]/.test(context) || /redirectTo/.test(context)) {
        continue;
      }

      // Skip if already inside a lazy-loaded context
      if (/loadChildren|loadComponent/.test(context)) {
        continue;
      }

      // Only flag routes with a meaningful path
      const pathMatch = context.match(/path\s*:\s*['"]([^'"]+)['"]/);
      if (pathMatch && pathMatch[1].length > 0) {
        diagnostics.push({
          ruleId: 'lazy-loading-opportunities',
          message: `Route "${pathMatch[1]}" loads component eagerly. Consider lazy loading with loadComponent or loadChildren.`,
          severity: 'hint',
          category: 'performance',
          location: {
            file,
            line: i,
            column: line.indexOf('component'),
          },
          suggestion: `Replace \`component: XComponent\` with \`loadComponent: () => import('./path').then(m => m.XComponent)\` for better initial load performance.`,
        });
      }
    }
  }

  return diagnostics;
}

function detectEagerModuleImports(
  file: AngularFile,
  lines: string[],
  index: ProjectIndex,
): AnalysisDiagnostic[] {
  const diagnostics: AnalysisDiagnostic[] = [];

  // Find the imports array in @NgModule
  const content = file.content;
  const importsMatch = content.match(/@NgModule\s*\(\s*\{[\s\S]*?imports\s*:\s*\[([\s\S]*?)\]/);
  if (!importsMatch) return diagnostics;

  const importsBlock = importsMatch[1];

  // Find feature modules (not Angular built-in modules)
  const angularModules = new Set([
    'BrowserModule', 'CommonModule', 'FormsModule', 'ReactiveFormsModule',
    'HttpClientModule', 'RouterModule', 'BrowserAnimationsModule',
    'NoopAnimationsModule',
  ]);

  const moduleRegex = /(\w+Module)\b/g;
  let match;
  while ((match = moduleRegex.exec(importsBlock)) !== null) {
    const moduleName = match[1];

    if (angularModules.has(moduleName)) continue;
    if (moduleName === 'AppModule' || moduleName === 'CoreModule') continue;

    // Check if this module exists as a file in the project (it's a feature module)
    const moduleFile = index.files.find(
      f => f.artifactType === 'module' && f.content.includes(`class ${moduleName}`)
    );

    if (moduleFile) {
      // Find the line in the imports array
      const importLine = findLineContaining(lines, moduleName, content.indexOf(importsBlock));

      diagnostics.push({
        ruleId: 'lazy-loading-opportunities',
        message: `Feature module "${moduleName}" is eagerly imported. Consider lazy loading via route configuration.`,
        severity: 'hint',
        category: 'performance',
        location: {
          file,
          line: importLine,
          column: 0,
        },
        suggestion: `Move "${moduleName}" to a lazy-loaded route: \`{ path: '...', loadChildren: () => import('./path').then(m => m.${moduleName}) }\``,
      });
    }
  }

  return diagnostics;
}

function findLineContaining(lines: string[], text: string, startOffset: number): number {
  // Approximate the line number from the offset
  let charCount = 0;
  for (let i = 0; i < lines.length; i++) {
    charCount += lines[i].length + 1;
    if (charCount >= startOffset && lines[i].includes(text)) {
      return i;
    }
  }
  // Fallback: search from the beginning
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(text)) return i;
  }
  return 0;
}
