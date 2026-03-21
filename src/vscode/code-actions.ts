import * as vscode from 'vscode';
import * as path from 'path';
import { AiExplainParams, AiMigrationParams } from './commands';

const MIGRATION_RULES = new Set(['standalone-readiness', 'signals-migration']);

export class AdiCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'ADI') {
        continue;
      }

      // Rule-specific quick fixes
      switch (diagnostic.code) {
        case 'missing-unsubscribe':
          actions.push(...this.createUnsubscribeActions(document, diagnostic));
          break;
        case 'missing-onpush':
          actions.push(...this.createOnPushActions(document, diagnostic));
          break;
        case 'oversized-component':
          actions.push(...this.createOversizedActions(diagnostic));
          break;
      }

      // AI: "Explain with AI" for all ADI diagnostics
      actions.push(this.createExplainAction(document, diagnostic));

      // AI: "Generate Migration Plan" for migration-related rules
      if (MIGRATION_RULES.has(diagnostic.code as string)) {
        actions.push(this.createMigrationPlanAction(document, diagnostic));
      }
    }

    return actions;
  }

  private createUnsubscribeActions(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Quick fix: Add takeUntilDestroyed() pipe
    const addTakeUntil = new vscode.CodeAction(
      'Add takeUntilDestroyed() pipe',
      vscode.CodeActionKind.QuickFix
    );
    addTakeUntil.diagnostics = [diagnostic];
    addTakeUntil.isPreferred = true;

    // Find the .subscribe( on the diagnostic line and insert .pipe(takeUntilDestroyed()) before it
    const line = document.lineAt(diagnostic.range.start.line);
    const subscribeIndex = line.text.indexOf('.subscribe(');
    if (subscribeIndex >= 0) {
      const edit = new vscode.WorkspaceEdit();
      const insertPos = new vscode.Position(diagnostic.range.start.line, subscribeIndex);
      edit.insert(document.uri, insertPos, '.pipe(takeUntilDestroyed(this.destroyRef))');

      // Also need to add the import if not present
      const fullText = document.getText();
      if (!fullText.includes('takeUntilDestroyed')) {
        const lastImportLine = findLastImportLine(document);
        edit.insert(
          document.uri,
          new vscode.Position(lastImportLine + 1, 0),
          "import { takeUntilDestroyed } from '@angular/core/rxjs-interop';\n"
        );
      }
      if (!fullText.includes('DestroyRef')) {
        // Add DestroyRef to existing @angular/core import or create new one
        const coreImportLine = findImportLine(document, '@angular/core');
        if (coreImportLine >= 0) {
          const importLine = document.lineAt(coreImportLine);
          const closingBrace = importLine.text.indexOf('}');
          if (closingBrace >= 0) {
            edit.insert(
              document.uri,
              new vscode.Position(coreImportLine, closingBrace),
              ', DestroyRef'
            );
          }
        }
      }

      addTakeUntil.edit = edit;
    }

    actions.push(addTakeUntil);
    return actions;
  }

  private createOnPushActions(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    const addOnPush = new vscode.CodeAction(
      'Add ChangeDetectionStrategy.OnPush',
      vscode.CodeActionKind.QuickFix
    );
    addOnPush.diagnostics = [diagnostic];
    addOnPush.isPreferred = true;

    const edit = new vscode.WorkspaceEdit();
    const fullText = document.getText();

    // Find @Component({ and add changeDetection property
    const componentMatch = fullText.match(/@Component\s*\(\s*\{/);
    if (componentMatch && componentMatch.index !== undefined) {
      const insertOffset = componentMatch.index + componentMatch[0].length;
      const insertPos = document.positionAt(insertOffset);
      edit.insert(
        document.uri,
        insertPos,
        '\n  changeDetection: ChangeDetectionStrategy.OnPush,'
      );

      // Add ChangeDetectionStrategy to imports
      if (!fullText.includes('ChangeDetectionStrategy')) {
        const coreImportLine = findImportLine(document, '@angular/core');
        if (coreImportLine >= 0) {
          const importLine = document.lineAt(coreImportLine);
          const closingBrace = importLine.text.indexOf('}');
          if (closingBrace >= 0) {
            edit.insert(
              document.uri,
              new vscode.Position(coreImportLine, closingBrace),
              ', ChangeDetectionStrategy'
            );
          }
        }
      }
    }

    addOnPush.edit = edit;
    actions.push(addOnPush);
    return actions;
  }

  private createExplainAction(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Explain with AI',
      vscode.CodeActionKind.QuickFix
    );
    action.diagnostics = [diagnostic];

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const relativePath = workspaceRoot
      ? path.relative(workspaceRoot, document.uri.fsPath).replace(/\\/g, '/')
      : document.uri.fsPath;

    const params: AiExplainParams = {
      ruleId: diagnostic.code as string,
      message: diagnostic.message,
      severity: this.vscodeSeverityToString(diagnostic.severity),
      category: this.ruleCategory(diagnostic.code as string),
      fileUri: document.uri.toString(),
      relativePath,
      line: diagnostic.range.start.line,
      column: diagnostic.range.start.character,
      suggestion: diagnostic.relatedInformation?.[0]?.message,
    };

    action.command = {
      command: 'adi.explainDiagnostic',
      title: 'Explain with AI',
      arguments: [params],
    };

    return action;
  }

  private createMigrationPlanAction(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Generate Migration Plan with AI',
      vscode.CodeActionKind.QuickFix
    );
    action.diagnostics = [diagnostic];

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const relativePath = workspaceRoot
      ? path.relative(workspaceRoot, document.uri.fsPath).replace(/\\/g, '/')
      : document.uri.fsPath;

    const target = diagnostic.code === 'standalone-readiness' ? 'standalone components' : 'Angular Signals';

    const params: AiMigrationParams = {
      fileUri: document.uri.toString(),
      relativePath,
      target,
    };

    action.command = {
      command: 'adi.generateMigrationPlan',
      title: 'Generate Migration Plan',
      arguments: [params],
    };

    return action;
  }

  private vscodeSeverityToString(severity: vscode.DiagnosticSeverity): string {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error: return 'error';
      case vscode.DiagnosticSeverity.Warning: return 'warning';
      case vscode.DiagnosticSeverity.Information: return 'info';
      case vscode.DiagnosticSeverity.Hint: return 'hint';
    }
  }

  private ruleCategory(ruleId: string): string {
    if (['missing-unsubscribe', 'oversized-component', 'direct-dom-manipulation'].includes(ruleId)) return 'anti-pattern';
    if (['missing-onpush', 'template-method-calls', 'lazy-loading-opportunities'].includes(ruleId)) return 'performance';
    if (['standalone-readiness', 'signals-migration'].includes(ruleId)) return 'migration';
    return 'architecture';
  }

  private createOversizedActions(diagnostic: vscode.Diagnostic): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // For oversized components, we can only suggest - not auto-fix
    const viewSuggestion = new vscode.CodeAction(
      'View split suggestions',
      vscode.CodeActionKind.QuickFix
    );
    viewSuggestion.diagnostics = [diagnostic];

    // Show the suggestion from related information
    if (diagnostic.relatedInformation && diagnostic.relatedInformation.length > 0) {
      viewSuggestion.command = {
        command: 'adi.showSuggestion',
        title: 'View ADI Suggestion',
        arguments: [diagnostic.relatedInformation[0].message],
      };
    }

    actions.push(viewSuggestion);
    return actions;
  }
}

function findLastImportLine(document: vscode.TextDocument): number {
  let lastImport = 0;
  for (let i = 0; i < Math.min(document.lineCount, 50); i++) {
    if (document.lineAt(i).text.startsWith('import ')) {
      lastImport = i;
    }
  }
  return lastImport;
}

function findImportLine(document: vscode.TextDocument, moduleSpecifier: string): number {
  for (let i = 0; i < Math.min(document.lineCount, 50); i++) {
    if (document.lineAt(i).text.includes(moduleSpecifier)) {
      return i;
    }
  }
  return -1;
}
