import { AnalysisRule, AnalysisDiagnostic } from '../analyzer.types';
import { AngularFile, ProjectIndex } from '../../scanner/project-model';

/**
 * Rule: shared-module-bloat
 *
 * Detects SharedModules that have grown too large. A bloated shared
 * module forces every importing module to load everything, even if
 * it only needs one component. Signs of bloat:
 * - Too many declarations (> 15)
 * - Too many exports (> 15)
 * - Re-exporting many third-party modules
 * - Declarations that are only used by one other module (should be co-located)
 *
 * Fix: split into focused shared modules (SharedFormsModule, SharedTableModule, etc.)
 */

const DECLARATION_THRESHOLD = 15;
const EXPORT_THRESHOLD = 15;

export const sharedModuleBloatRule: AnalysisRule = {
  id: 'shared-module-bloat',
  name: 'Shared Module Bloat',
  description: 'Detect SharedModules that are too large and should be split',
  severity: 'hint',
  category: 'architecture',

  analyze(file: AngularFile, _index: ProjectIndex): AnalysisDiagnostic[] {
    if (file.artifactType !== 'module' || file.extension !== '.ts') {
      return [];
    }

    // Only target shared modules
    if (!isSharedModule(file)) {
      return [];
    }

    const content = file.content;
    const diagnostics: AnalysisDiagnostic[] = [];

    // Extract @NgModule metadata
    const ngModuleMatch = content.match(/@NgModule\s*\(\s*\{([\s\S]*?)\}\s*\)/);
    if (!ngModuleMatch) return diagnostics;

    const moduleBody = ngModuleMatch[1];

    const declarations = extractArrayItems(moduleBody, 'declarations');
    const exports = extractArrayItems(moduleBody, 'exports');
    const imports = extractArrayItems(moduleBody, 'imports');

    const moduleLine = findDecoratorLine(content);

    // Check declaration count
    if (declarations.length > DECLARATION_THRESHOLD) {
      diagnostics.push({
        ruleId: 'shared-module-bloat',
        message: `SharedModule has ${declarations.length} declarations (threshold: ${DECLARATION_THRESHOLD}). Consider splitting into focused modules.`,
        severity: 'hint',
        category: 'architecture',
        location: {
          file,
          line: moduleLine,
          column: 0,
        },
        suggestion: `Group related declarations into smaller shared modules (e.g., SharedFormsModule, SharedTableModule). Each consuming module only imports what it needs.`,
      });
    }

    // Check export count
    if (exports.length > EXPORT_THRESHOLD) {
      diagnostics.push({
        ruleId: 'shared-module-bloat',
        message: `SharedModule exports ${exports.length} items (threshold: ${EXPORT_THRESHOLD}). Importing modules get everything, even what they don't use.`,
        severity: 'hint',
        category: 'architecture',
        location: {
          file,
          line: moduleLine,
          column: 0,
        },
        suggestion: `Split exports into domain-specific shared modules. Consider standalone components which can be imported individually.`,
      });
    }

    // Check for heavy third-party module re-exports
    const thirdPartyModules = imports.filter(name =>
      !name.includes('Common') && name.endsWith('Module') && isThirdParty(name)
    );
    if (thirdPartyModules.length > 5) {
      diagnostics.push({
        ruleId: 'shared-module-bloat',
        message: `SharedModule re-exports ${thirdPartyModules.length} third-party modules. Each importing module inherits all of them.`,
        severity: 'hint',
        category: 'architecture',
        location: {
          file,
          line: moduleLine,
          column: 0,
        },
        suggestion: `Move third-party module imports to the feature modules that actually use them, or create focused wrapper modules.`,
      });
    }

    return diagnostics;
  },
};

function isSharedModule(file: AngularFile): boolean {
  const name = file.relativePath.toLowerCase();
  return name.includes('shared.module') ||
    name.includes('shared/') && name.endsWith('.module.ts') ||
    file.content.includes('class SharedModule');
}

function extractArrayItems(moduleBody: string, propertyName: string): string[] {
  const regex = new RegExp(`${propertyName}\\s*:\\s*\\[([\\s\\S]*?)\\]`);
  const match = moduleBody.match(regex);
  if (!match) return [];

  const arrayContent = match[1];
  // Extract identifiers (component/module names)
  const items: string[] = [];
  const itemRegex = /\b([A-Z]\w+)\b/g;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(arrayContent)) !== null) {
    items.push(itemMatch[1]);
  }
  return items;
}

function findDecoratorLine(content: string): number {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('@NgModule')) return i;
  }
  return 0;
}

function isThirdParty(moduleName: string): boolean {
  // Angular built-in modules are not "third party" for this check
  const angularBuiltIn = new Set([
    'CommonModule', 'FormsModule', 'ReactiveFormsModule',
    'HttpClientModule', 'RouterModule',
  ]);
  return !angularBuiltIn.has(moduleName);
}
