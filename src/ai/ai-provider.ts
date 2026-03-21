import { AnalysisDiagnostic } from '../analyzers/analyzer.types';

export interface AiExplanation {
  summary: string;
  whyItMatters: string;
  howToFix: string;
  codeExample?: string;
}

export interface AiMigrationPlan {
  steps: string[];
  estimatedEffort: string;
  risks: string[];
}

export interface AiProvider {
  readonly name: string;
  readonly isConfigured: boolean;

  explainDiagnostic(diagnostic: AnalysisDiagnostic, fileContent: string): Promise<AiExplanation>;
  generateMigrationPlan(fileContent: string, targetPattern: string): Promise<AiMigrationPlan>;
}
