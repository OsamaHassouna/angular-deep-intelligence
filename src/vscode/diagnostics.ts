import * as vscode from 'vscode';
import { AnalysisDiagnostic, Severity } from '../analyzers/analyzer.types';

const SEVERITY_MAP: Record<Severity, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
  hint: vscode.DiagnosticSeverity.Hint,
};

export class DiagnosticsManager {
  private collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('angular-deep-intelligence');
  }

  update(diagnostics: AnalysisDiagnostic[]): void {
    this.collection.clear();

    // Group diagnostics by file URI
    const byFile = new Map<string, vscode.Diagnostic[]>();

    for (const diag of diagnostics) {
      const uri = diag.location.file.uri;
      if (!byFile.has(uri)) {
        byFile.set(uri, []);
      }

      const range = new vscode.Range(
        diag.location.line,
        diag.location.column >= 0 ? diag.location.column : 0,
        diag.location.endLine ?? diag.location.line,
        diag.location.endColumn ?? (diag.location.column >= 0 ? diag.location.column + 20 : 80)
      );

      const vscodeDiag = new vscode.Diagnostic(
        range,
        diag.message,
        SEVERITY_MAP[diag.severity]
      );

      vscodeDiag.source = 'ADI';
      vscodeDiag.code = diag.ruleId;

      if (diag.suggestion) {
        vscodeDiag.relatedInformation = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(vscode.Uri.parse(uri), range),
            diag.suggestion
          ),
        ];
      }

      byFile.get(uri)!.push(vscodeDiag);
    }

    for (const [uri, diags] of byFile) {
      this.collection.set(vscode.Uri.parse(uri), diags);
    }
  }

  updateForFile(uri: string, diagnostics: AnalysisDiagnostic[]): void {
    const vscodeDiags: vscode.Diagnostic[] = [];

    for (const diag of diagnostics) {
      const range = new vscode.Range(
        diag.location.line,
        diag.location.column >= 0 ? diag.location.column : 0,
        diag.location.endLine ?? diag.location.line,
        diag.location.endColumn ?? (diag.location.column >= 0 ? diag.location.column + 20 : 80)
      );

      const vscodeDiag = new vscode.Diagnostic(
        range,
        diag.message,
        SEVERITY_MAP[diag.severity]
      );

      vscodeDiag.source = 'ADI';
      vscodeDiag.code = diag.ruleId;

      if (diag.suggestion) {
        vscodeDiag.relatedInformation = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(vscode.Uri.parse(uri), range),
            diag.suggestion
          ),
        ];
      }

      vscodeDiags.push(vscodeDiag);
    }

    this.collection.set(vscode.Uri.parse(uri), vscodeDiags);
  }

  clear(): void {
    this.collection.clear();
  }

  dispose(): void {
    this.collection.dispose();
  }
}
