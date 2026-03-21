import { AnalysisRule, AnalysisDiagnostic } from '../analyzer.types';
import { AngularFile, ProjectIndex } from '../../scanner/project-model';

/**
 * Rule: missing-onpush
 *
 * Detects components without OnPush change detection strategy.
 * Prioritizes leaf components (components whose templates don't reference other components).
 *
 * OnPush is a significant performance optimization that prevents unnecessary
 * change detection cycles. Most components should use it.
 *
 * Reports as 'info' for non-leaf components, 'warning' for leaf components.
 */
export const missingOnPushRule: AnalysisRule = {
  id: 'missing-onpush',
  name: 'Missing OnPush',
  description: 'Detect components missing OnPush change detection strategy',
  severity: 'info',
  category: 'performance',

  analyze(file: AngularFile, index: ProjectIndex): AnalysisDiagnostic[] {
    if (file.artifactType !== 'component' || file.extension !== '.ts') {
      return [];
    }

    const content = file.content;

    // Check if ChangeDetectionStrategy.OnPush is already set
    if (content.includes('ChangeDetectionStrategy.OnPush')) {
      return [];
    }

    // Check if changeDetection is set at all
    const hasChangeDetection = /changeDetection\s*:/.test(content);
    if (hasChangeDetection) {
      // Has changeDetection but it's not OnPush (probably Default explicitly set)
      // Still flag it
    }

    // Find the @Component decorator line
    const componentDecoratorMatch = content.match(/@Component\s*\(/);
    if (!componentDecoratorMatch) {
      return [];
    }

    const decoratorIndex = content.indexOf('@Component');
    const line = getLineNumber(content, decoratorIndex);

    // Determine if this is a leaf component
    const isLeaf = isLeafComponent(file, index);
    const severity = isLeaf ? 'info' : 'hint';

    return [{
      ruleId: 'missing-onpush',
      message: `Component missing ChangeDetectionStrategy.OnPush${isLeaf ? ' (leaf component - easy win)' : ''}.`,
      severity,
      category: 'performance',
      location: {
        file,
        line,
        column: 0,
      },
      suggestion: 'Add changeDetection: ChangeDetectionStrategy.OnPush to the @Component decorator. Ensure the component uses immutable data patterns or Observables with async pipe.',
    }];
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

function isLeafComponent(file: AngularFile, index: ProjectIndex): boolean {
  // A leaf component's template doesn't contain selectors of other components in the project
  const templateFile = file.linkedTemplatePath
    ? index.fileMap.get(file.linkedTemplatePath)
    : null;

  // Check inline template if no external template
  let templateContent = '';
  if (templateFile) {
    templateContent = templateFile.content;
  } else {
    // Try to extract inline template
    const inlineMatch = file.content.match(/template\s*:\s*[`'"]([^`'"]*)[`'"]/s);
    if (inlineMatch) {
      templateContent = inlineMatch[1];
    }
  }

  if (!templateContent) {
    // No template found, assume leaf
    return true;
  }

  // Get all component selectors from the project
  const componentSelectors = getProjectComponentSelectors(index);

  // Check if template uses any project component selectors
  for (const selector of componentSelectors) {
    if (selector === getComponentSelector(file)) {
      continue; // Skip self
    }
    // Check for element selectors like <app-something>
    if (templateContent.includes(`<${selector}`)) {
      return false;
    }
  }

  return true;
}

function getProjectComponentSelectors(index: ProjectIndex): string[] {
  const selectors: string[] = [];
  for (const file of index.files) {
    if (file.artifactType === 'component') {
      const selector = getComponentSelector(file);
      if (selector) {
        selectors.push(selector);
      }
    }
  }
  return selectors;
}

function getComponentSelector(file: AngularFile): string | null {
  const match = file.content.match(/selector\s*:\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}
