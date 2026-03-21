import * as vscode from 'vscode';
import { WorkspaceScanner } from './scanner/workspace-scanner';
import { AnalyzerRegistry } from './analyzers/analyzer-registry';
import { DiagnosticsManager } from './vscode/diagnostics';
import { AdiCodeActionProvider } from './vscode/code-actions';
import { StatusBarManager } from './vscode/status-bar';
import { CommandManager } from './vscode/commands';
import { AdiTreeDataProvider } from './vscode/tree-view';
import { AiProvider } from './ai/ai-provider';
import { ClaudeProvider } from './ai/claude-provider';
import { VsCodeLmProvider } from './ai/vscode-lm-provider';
import { log, disposeLogger } from './utils/logger';

let commandManager: CommandManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  log('Angular Deep Intelligence activating...');

  // Core instances
  const scanner = new WorkspaceScanner();
  const registry = new AnalyzerRegistry();
  const diagnosticsManager = new DiagnosticsManager();
  const statusBar = new StatusBarManager();
  const treeDataProvider = new AdiTreeDataProvider();

  // Register TreeView panel
  const treeView = vscode.window.createTreeView('adiDashboard', {
    treeDataProvider,
    showCollapseAll: true,
  });

  // AI provider: prefer VS Code Chat models, fall back to direct Claude API key
  const aiProvider = resolveAiProvider();

  // Command manager wires everything together
  commandManager = new CommandManager(scanner, registry, diagnosticsManager, statusBar, treeDataProvider, aiProvider);
  commandManager.registerCommands(context);

  // File watcher: re-analyze on save
  const fileWatcher = vscode.workspace.onDidSaveTextDocument(document => {
    if (document.languageId === 'typescript' || document.languageId === 'html') {
      commandManager?.onFileSaved(document);
    }
  });

  // Register code action provider for TypeScript files
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    { language: 'typescript', scheme: 'file' },
    new AdiCodeActionProvider(),
    { providedCodeActionKinds: AdiCodeActionProvider.providedCodeActionKinds }
  );

  // Cleanup
  context.subscriptions.push(
    diagnosticsManager,
    statusBar,
    treeView,
    codeActionProvider,
    fileWatcher,
    { dispose: () => disposeLogger() },
  );

  log('Angular Deep Intelligence activated.');
}

export function deactivate(): void {
  commandManager = undefined;
}

function resolveAiProvider(): AiProvider {
  // VS Code 1.90+ exposes the Language Model API
  if (typeof vscode.lm !== 'undefined') {
    log('AI provider: VS Code Chat (uses your existing AI setup)');
    return new VsCodeLmProvider();
  }

  // Fallback: direct Claude API key
  const claudeProvider = new ClaudeProvider();
  if (claudeProvider.isConfigured) {
    log('AI provider: Claude API (direct key)');
  } else {
    log('AI provider: Claude API (key not yet configured)');
  }
  return claudeProvider;
}
