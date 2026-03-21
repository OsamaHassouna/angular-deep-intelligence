import { AnalysisRule, AnalysisDiagnostic } from '../analyzer.types';
import { AngularFile, ProjectIndex } from '../../scanner/project-model';

/**
 * Rule: standalone-readiness
 *
 * Scores NgModule-based components on their readiness to migrate to standalone.
 * Analyzes:
 * - Number of module dependencies
 * - Provider complexity
 * - Shared module usage
 * - Import graph depth
 *
 * Reports as 'info' with a readiness score and migration notes.
 */
export const standaloneReadinessRule: AnalysisRule = {
  id: 'standalone-readiness',
  name: 'Standalone Readiness',
  description: 'Score NgModule components on standalone migration readiness',
  severity: 'hint',
  category: 'migration',

  analyze(file: AngularFile, index: ProjectIndex): AnalysisDiagnostic[] {
    // Only analyze components that are NOT already standalone
    if (file.artifactType !== 'component' || file.extension !== '.ts') {
      return [];
    }

    const content = file.content;

    // Skip if already standalone
    if (/standalone\s*:\s*true/.test(content)) {
      return [];
    }

    // Find which module declares this component
    const componentClassName = extractClassName(content);
    if (!componentClassName) {
      return [];
    }

    const declaringModule = findDeclaringModule(componentClassName, index);
    if (!declaringModule) {
      // No module found - might already be standalone or orphaned
      // If no @NgModule references this component, it's likely standalone-ready
      return [];
    }

    // Score readiness (0-100)
    const score = calculateReadinessScore(file, declaringModule, index);
    const notes = generateMigrationNotes(file, declaringModule, index, score);

    const readinessLabel = score >= 80 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';

    const componentLine = content.indexOf('@Component');
    const line = componentLine >= 0 ? getLineNumber(content, componentLine) : 0;

    return [{
      ruleId: 'standalone-readiness',
      message: `Standalone readiness: ${readinessLabel} (${score}/100). This component is declared in ${extractClassName(declaringModule.content) || 'a module'}.`,
      severity: 'hint',
      category: 'migration',
      location: {
        file,
        line,
        column: 0,
      },
      suggestion: notes.join('\n'),
    }];
  },
};

function extractClassName(content: string): string | null {
  const match = content.match(/export\s+class\s+(\w+)/);
  return match ? match[1] : null;
}

function findDeclaringModule(componentClassName: string, index: ProjectIndex): AngularFile | null {
  for (const file of index.files) {
    if (file.artifactType !== 'module') continue;
    // Check if declarations array contains this component
    if (file.content.includes(componentClassName)) {
      return file;
    }
  }
  return null;
}

function calculateReadinessScore(
  component: AngularFile,
  declaringModule: AngularFile,
  index: ProjectIndex
): number {
  let score = 100;
  const moduleContent = declaringModule.content;

  // Penalty: Module has many declarations (harder to untangle)
  const declarationsMatch = moduleContent.match(/declarations\s*:\s*\[([\s\S]*?)\]/);
  if (declarationsMatch) {
    const declarationCount = declarationsMatch[1].split(',').filter(d => d.trim()).length;
    if (declarationCount > 10) score -= 20;
    else if (declarationCount > 5) score -= 10;
  }

  // Penalty: Module has complex providers
  const providersMatch = moduleContent.match(/providers\s*:\s*\[([\s\S]*?)\]/);
  if (providersMatch) {
    const providerContent = providersMatch[1];
    const providerCount = providerContent.split(',').filter(p => p.trim()).length;
    if (providerCount > 5) score -= 15;
    else if (providerCount > 2) score -= 5;

    // Extra penalty for useFactory/useClass providers (complex DI)
    if (/useFactory|useClass|useExisting/.test(providerContent)) {
      score -= 10;
    }
  }

  // Penalty: Component has many imports from the same module
  const componentImports = component.imports.raw.filter(imp => imp.startsWith('.'));
  const moduleDir = declaringModule.relativePath.split('/').slice(0, -1).join('/');
  const sameModuleImports = componentImports.filter(imp => {
    // Rough check: are imports within the same module directory
    return component.imports.resolved.some(r => r.startsWith(moduleDir));
  });
  if (sameModuleImports.length > 5) score -= 10;

  // Bonus: Component has few dependencies
  if (componentImports.length <= 3) score += 5;

  // Bonus: No template references to other module-declared components
  // (would need to be added as imports in standalone)
  const otherModuleComponents = index.files.filter(f =>
    f.artifactType === 'component' &&
    f.relativePath !== component.relativePath &&
    declaringModule.content.includes(extractClassName(f.content) || '__never__')
  );
  if (otherModuleComponents.length === 0) score += 5;

  return Math.max(0, Math.min(100, score));
}

function generateMigrationNotes(
  _component: AngularFile,
  declaringModule: AngularFile,
  _index: ProjectIndex,
  score: number
): string[] {
  const notes: string[] = [];
  const moduleContent = declaringModule.content;

  if (score >= 80) {
    notes.push('Easy migration: Add standalone: true, move module imports to component imports array.');
  }

  // Check what module imports would need to move
  const importsMatch = moduleContent.match(/imports\s*:\s*\[([\s\S]*?)\]/);
  if (importsMatch) {
    const imports = importsMatch[1].split(',').map(i => i.trim()).filter(Boolean);
    const commonModules = imports.filter(i =>
      /CommonModule|FormsModule|ReactiveFormsModule|RouterModule|HttpClientModule/.test(i)
    );
    if (commonModules.length > 0) {
      notes.push(`Add to component imports: ${commonModules.join(', ')}`);
    }
  }

  const providersMatch = moduleContent.match(/providers\s*:\s*\[([\s\S]*?)\]/);
  if (providersMatch && providersMatch[1].trim()) {
    notes.push('Module has providers - ensure they use providedIn: \'root\' or move to component providers.');
  }

  return notes;
}

function getLineNumber(content: string, index: number): number {
  let line = 0;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}
