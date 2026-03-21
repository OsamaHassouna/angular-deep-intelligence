import { AnalysisRule, AnalysisDiagnostic } from './analyzer.types';
import { AngularFile, ProjectIndex } from '../scanner/project-model';
import { getConfig } from '../utils/config';
import { log } from '../utils/logger';

// Rule imports
import { missingUnsubscribeRule } from './rules/missing-unsubscribe';
import { missingOnPushRule } from './rules/missing-onpush';
import { oversizedComponentRule } from './rules/oversized-component';
import { directDomManipulationRule } from './rules/direct-dom-manipulation';
import { templateMethodCallsRule } from './rules/template-method-calls';
import { standaloneReadinessRule } from './rules/standalone-readiness';
import { signalsMigrationRule } from './rules/signals-migration';
import { circularServiceDepsRule } from './rules/circular-service-deps';
import { lazyLoadingOpportunitiesRule } from './rules/lazy-loading-opportunities';
import { sharedModuleBloatRule } from './rules/shared-module-bloat';

export class AnalyzerRegistry {
  private rules: AnalysisRule[] = [];

  constructor() {
    this.registerBuiltinRules();
  }

  private registerBuiltinRules(): void {
    this.register(missingUnsubscribeRule);
    this.register(missingOnPushRule);
    this.register(oversizedComponentRule);
    this.register(directDomManipulationRule);
    this.register(templateMethodCallsRule);
    this.register(standaloneReadinessRule);
    this.register(signalsMigrationRule);
    this.register(circularServiceDepsRule);
    this.register(lazyLoadingOpportunitiesRule);
    this.register(sharedModuleBloatRule);
  }

  register(rule: AnalysisRule): void {
    this.rules.push(rule);
  }

  getEnabledRules(): AnalysisRule[] {
    const config = getConfig();
    const ruleSettings: Record<string, boolean> = {
      'missing-unsubscribe': config.rules.missingUnsubscribe,
      'missing-onpush': config.rules.missingOnPush,
      'oversized-component': config.rules.oversizedComponent,
      'direct-dom-manipulation': config.rules.directDomManipulation,
      'template-method-calls': config.rules.templateMethodCalls,
      'standalone-readiness': config.rules.standaloneReadiness,
      'signals-migration': config.rules.signalsMigration,
      'circular-service-deps': config.rules.circularServiceDeps,
      'lazy-loading-opportunities': config.rules.lazyLoadingOpportunities,
      'shared-module-bloat': config.rules.sharedModuleBloat,
    };

    return this.rules.filter(rule => ruleSettings[rule.id] !== false);
  }

  runAll(index: ProjectIndex): AnalysisDiagnostic[] {
    const enabledRules = this.getEnabledRules();
    const diagnostics: AnalysisDiagnostic[] = [];

    log(`Running ${enabledRules.length} rules against ${index.files.length} files`);

    for (const file of index.files) {
      for (const rule of enabledRules) {
        try {
          const results = rule.analyze(file, index);
          diagnostics.push(...results);
        } catch {
          // Skip files that fail analysis silently
        }
      }
    }

    log(`Analysis complete: ${diagnostics.length} diagnostics found`);
    return diagnostics;
  }

  runForFile(file: AngularFile, index: ProjectIndex): AnalysisDiagnostic[] {
    const enabledRules = this.getEnabledRules();
    const diagnostics: AnalysisDiagnostic[] = [];

    for (const rule of enabledRules) {
      try {
        const results = rule.analyze(file, index);
        diagnostics.push(...results);
      } catch {
        // Skip silently
      }
    }

    return diagnostics;
  }

  getRuleIds(): string[] {
    return this.rules.map(r => r.id);
  }
}
