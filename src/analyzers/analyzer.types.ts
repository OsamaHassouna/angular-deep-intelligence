import { AngularFile, ProjectIndex } from '../scanner/project-model';

export type Severity = 'error' | 'warning' | 'info' | 'hint';

export type RuleCategory = 'anti-pattern' | 'migration' | 'architecture' | 'performance';

export interface DiagnosticLocation {
  file: AngularFile;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface AnalysisDiagnostic {
  ruleId: string;
  message: string;
  severity: Severity;
  category: RuleCategory;
  location: DiagnosticLocation;
  suggestion?: string;
  codeSnippet?: string;
}

export interface AnalysisRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  category: RuleCategory;
  analyze(file: AngularFile, index: ProjectIndex): AnalysisDiagnostic[];
}
