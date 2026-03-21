import * as vscode from 'vscode';
import { AnalysisDiagnostic } from '../analyzers/analyzer.types';
import { ProjectStats } from '../scanner/project-model';

export class StatusBarManager {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'adi.scanProject';
    this.item.tooltip = 'Angular Deep Intelligence - Click to scan';
    this.item.text = '$(shield) ADI';
    this.item.show();
  }

  updateWithScore(score: number, diagnostics: AnalysisDiagnostic[], stats: ProjectStats): void {
    const icon = score >= 80 ? '$(pass)' : score >= 50 ? '$(warning)' : '$(error)';

    const errors = diagnostics.filter(d => d.severity === 'error').length;
    const warnings = diagnostics.filter(d => d.severity === 'warning').length;
    const info = diagnostics.filter(d => d.severity === 'info').length;
    const hints = diagnostics.filter(d => d.severity === 'hint').length;

    this.item.text = `${icon} ADI: ${score}/100`;

    // VS Code only supports warning (orange) and error (red) backgrounds.
    // For good scores, use green text color instead.
    if (score >= 80) {
      this.item.backgroundColor = undefined;
      this.item.color = new vscode.ThemeColor('testing.iconPassed');
    } else if (score >= 50) {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.item.color = undefined;
    } else {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.item.color = undefined;
    }
    this.item.tooltip = `Angular Deep Intelligence\nHealth: ${score}/100\n\nErrors: ${errors} | Warnings: ${warnings} | Info: ${info} | Hints: ${hints}\nFiles: ${stats.fileCount}\n\nClick to re-scan`;
  }

  setScanning(): void {
    this.item.text = '$(sync~spin) ADI: Scanning...';
    this.item.backgroundColor = undefined;
    this.item.color = undefined;
  }

  dispose(): void {
    this.item.dispose();
  }
}

