import * as vscode from 'vscode';
import { WorkspaceScanner } from '../scanner/workspace-scanner';
import { AnalyzerRegistry } from '../analyzers/analyzer-registry';
import { DiagnosticsManager } from './diagnostics';
import { StatusBarManager } from './status-bar';
import { AdiTreeDataProvider } from './tree-view';
import { log, logError } from '../utils/logger';
import { ProjectIndex, AngularFile } from '../scanner/project-model';
import { AnalysisDiagnostic } from '../analyzers/analyzer.types';
import { normalizeRelativePath } from '../utils/path-utils';
import { FileCache } from '../utils/cache';
import { AiProvider, AiExplanation, AiMigrationPlan } from '../ai/ai-provider';
import { VsCodeLmProvider } from '../ai/vscode-lm-provider';
import { openChat, getInstalledProviders } from './chat-routing';
import { extractDependencyGraph } from '../graph/dependency-extractor';
import { DependencyGraphPanel } from '../graph/graph-webview';
import * as path from 'path';

export interface AiExplainParams {
  ruleId: string;
  message: string;
  severity: string;
  category: string;
  fileUri: string;
  relativePath: string;
  line: number;
  column: number;
  suggestion?: string;
}

export interface AiMigrationParams {
  fileUri: string;
  relativePath: string;
  target: string;
}

export class CommandManager {
  private scanner: WorkspaceScanner;
  private registry: AnalyzerRegistry;
  private diagnosticsManager: DiagnosticsManager;
  private statusBar: StatusBarManager;
  private treeDataProvider: AdiTreeDataProvider;
  private aiProvider: AiProvider | undefined;
  private currentIndex: ProjectIndex | null = null;
  private lastDiagnostics: AnalysisDiagnostic[] = [];
  private analysisCache: FileCache<AnalysisDiagnostic[]>;
  private healthScore = 0;

  constructor(
    scanner: WorkspaceScanner,
    registry: AnalyzerRegistry,
    diagnosticsManager: DiagnosticsManager,
    statusBar: StatusBarManager,
    treeDataProvider: AdiTreeDataProvider,
    aiProvider?: AiProvider,
  ) {
    this.scanner = scanner;
    this.registry = registry;
    this.diagnosticsManager = diagnosticsManager;
    this.statusBar = statusBar;
    this.treeDataProvider = treeDataProvider;
    this.aiProvider = aiProvider;
    this.analysisCache = new FileCache();
  }

  registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('adi.scanProject', () => this.scanProject()),
      vscode.commands.registerCommand('adi.clearDiagnostics', () => this.clearDiagnostics()),
      vscode.commands.registerCommand('adi.showSuggestion', (message: string) => this.showSuggestion(message)),
      vscode.commands.registerCommand('adi.explainDiagnostic', (params: AiExplainParams) => this.explainDiagnostic(params)),
      vscode.commands.registerCommand('adi.generateMigrationPlan', (params: AiMigrationParams) => this.generateMigrationPlan(params)),
      vscode.commands.registerCommand('adi.selectAiModel', () => this.selectAiModel()),
      vscode.commands.registerCommand('adi.showDependencyGraph', () => this.showDependencyGraph()),
    );
  }

  async scanProject(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('ADI: No workspace folder open.');
      return;
    }

    const rootUri = workspaceFolders[0].uri;
    this.statusBar.setScanning();

    try {
      log('Starting full project scan...');
      const scanStart = Date.now();

      // Scan workspace
      this.currentIndex = await this.scanner.scan(rootUri);

      // Run analysis (with caching)
      this.lastDiagnostics = this.runAnalysisWithCache(this.currentIndex);

      // Calculate health score
      this.healthScore = this.calculateHealthScore();

      // Update all UI
      this.diagnosticsManager.update(this.lastDiagnostics);
      this.statusBar.updateWithScore(this.healthScore,this.lastDiagnostics, this.currentIndex.stats);
      this.treeDataProvider.update(this.lastDiagnostics, this.currentIndex.stats, this.healthScore);

      const elapsed = Date.now() - scanStart;

      // Show summary
      const summary = this.buildSummary(elapsed);
      vscode.window.showInformationMessage(summary);
      log(summary);
    } catch (err) {
      logError('Scan failed', err);
      vscode.window.showErrorMessage(`ADI: Scan failed - ${err instanceof Error ? err.message : String(err)}`);
      const emptyStats = { fileCount: 0, componentCount: 0, serviceCount: 0, routeCount: 0, htmlCount: 0, styleCount: 0, pipeCount: 0, directiveCount: 0, moduleCount: 0 };
      this.statusBar.updateWithScore(this.healthScore,[], emptyStats);
      this.treeDataProvider.clear();
    }
  }

  onFileSaved(document: vscode.TextDocument): void {
    if (!this.currentIndex) {
      return; // No scan done yet, skip incremental
    }

    const rootPath = this.currentIndex.rootPath;
    const filePath = document.uri.fsPath;

    // Must be within workspace
    if (!filePath.startsWith(rootPath)) {
      return;
    }

    const relativePath = normalizeRelativePath(path.relative(rootPath, filePath));
    const existingFile = this.currentIndex.fileMap.get(relativePath);

    if (!existingFile) {
      return; // File not in our index (might be spec, might be new)
    }

    log(`Incremental re-analysis: ${relativePath}`);

    // Update file content in the index
    const newContent = document.getText();
    existingFile.content = newContent;
    existingFile.lineCount = newContent.split('\n').length;
    existingFile.sizeBytes = Buffer.byteLength(newContent, 'utf8');

    // Invalidate cache for this file
    this.analysisCache.invalidate(relativePath);

    // Re-analyze just this file
    const fileDiagnostics = this.registry.runForFile(existingFile, this.currentIndex);

    // Cache the results
    this.analysisCache.set(relativePath, newContent, fileDiagnostics);

    // Replace diagnostics for this file in the full list
    this.lastDiagnostics = this.lastDiagnostics.filter(
      d => d.location.file.relativePath !== relativePath
    );
    this.lastDiagnostics.push(...fileDiagnostics);

    // Update UI
    this.diagnosticsManager.updateForFile(existingFile.uri, fileDiagnostics);
    this.healthScore = this.calculateHealthScore();
    this.statusBar.updateWithScore(this.healthScore,this.lastDiagnostics, this.currentIndex.stats);
    this.treeDataProvider.update(this.lastDiagnostics, this.currentIndex.stats, this.healthScore);
  }

  async explainDiagnostic(params: AiExplainParams): Promise<void> {
    // Build a rich prompt with full context
    const lines = [`Explain this Angular code issue found by the ADI extension.`,
      ``,
      `**Rule:** ${params.ruleId}`,
      `**Message:** ${params.message}`,
      `**Severity:** ${params.severity}`,
      `**File:** ${params.relativePath}:${params.line + 1}`,
    ];
    if (params.suggestion) {
      lines.push(`**ADI suggestion:** ${params.suggestion}`);
    }
    lines.push(``, `Please explain: what's wrong, why it matters, and how to fix it in this specific file. Include a code example if helpful.`);

    const query = lines.join('\n');

    // Try VS Code Chat first (Copilot, Claude, Codex, etc.)
    if (await this.openVsCodeChat(query)) {
      return;
    }

    // Fallback: direct API + webview
    if (this.aiProvider && this.aiProvider.isConfigured) {
      const fileUri = vscode.Uri.parse(params.fileUri);
      const fileBytes = await vscode.workspace.fs.readFile(fileUri);
      const fileContent = Buffer.from(fileBytes).toString('utf8');

      const diagnostic: AnalysisDiagnostic = {
        ruleId: params.ruleId,
        message: params.message,
        severity: params.severity as AnalysisDiagnostic['severity'],
        category: params.category as AnalysisDiagnostic['category'],
        location: {
          file: { uri: params.fileUri, relativePath: params.relativePath } as any,
          line: params.line,
          column: params.column,
        },
        suggestion: params.suggestion,
      };

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `ADI: Asking ${this.aiProvider.name} to explain...` },
        async () => {
          try {
            const explanation = await this.aiProvider!.explainDiagnostic(diagnostic, fileContent);
            this.showAiExplanationPanel(params, explanation);
          } catch (err) {
            logError('AI explain failed', err);
            vscode.window.showErrorMessage(`ADI: AI explanation failed - ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      );
      return;
    }

    vscode.window.showWarningMessage('ADI: No AI available. Install a chat extension (Copilot, Claude, Codex) or set adi.claudeApiKey.');
  }

  async generateMigrationPlan(params: AiMigrationParams): Promise<void> {
    const query = [
      `Generate an Angular migration plan for this file.`,
      ``,
      `**Target migration:** ${params.target}`,
      `**File:** ${params.relativePath}`,
      ``,
      `Please provide: step-by-step migration instructions, estimated effort (Small/Medium/Large), and any risks to watch for.`,
    ].join('\n');

    // Try VS Code Chat first
    if (await this.openVsCodeChat(query)) {
      return;
    }

    // Fallback: direct API + webview
    if (this.aiProvider && this.aiProvider.isConfigured) {
      const fileUri = vscode.Uri.parse(params.fileUri);
      const fileBytes = await vscode.workspace.fs.readFile(fileUri);
      const fileContent = Buffer.from(fileBytes).toString('utf8');

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `ADI: Generating migration plan via ${this.aiProvider.name}...` },
        async () => {
          try {
            const plan = await this.aiProvider!.generateMigrationPlan(fileContent, params.target);
            this.showMigrationPlanPanel(params, plan);
          } catch (err) {
            logError('AI migration plan failed', err);
            vscode.window.showErrorMessage(`ADI: Migration plan failed - ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      );
      return;
    }

    vscode.window.showWarningMessage('ADI: No AI available. Install a chat extension (Copilot, Claude, Codex) or set adi.claudeApiKey.');
  }

  /** Try to open an AI chat with the query, routing to the user's preferred provider. */
  private async openVsCodeChat(query: string): Promise<boolean> {
    return openChat(query);
  }

  private showAiExplanationPanel(params: AiExplainParams, explanation: AiExplanation): void {
    const panel = vscode.window.createWebviewPanel(
      'adiExplanation',
      `ADI: ${params.ruleId}`,
      vscode.ViewColumn.Beside,
      { enableScripts: false }
    );

    const codeBlock = explanation.codeExample
      ? `<h3>Suggested Fix</h3><pre><code>${this.escapeHtml(explanation.codeExample)}</code></pre>`
      : '';

    panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family, sans-serif); padding: 16px; color: var(--vscode-foreground); background: var(--vscode-editor-background); line-height: 1.6; }
    h2 { color: var(--vscode-textLink-foreground); margin-top: 0; }
    h3 { color: var(--vscode-textLink-foreground); margin-top: 20px; }
    .meta { opacity: 0.7; font-size: 0.9em; margin-bottom: 16px; }
    pre { background: var(--vscode-textBlockQuote-background); padding: 12px; border-radius: 4px; overflow-x: auto; }
    code { font-family: var(--vscode-editor-font-family, monospace); font-size: var(--vscode-editor-font-size, 13px); }
    .section { margin-bottom: 16px; }
  </style>
</head>
<body>
  <h2>${this.escapeHtml(params.ruleId)}</h2>
  <div class="meta">${this.escapeHtml(params.relativePath)}:${params.line + 1}</div>
  <div class="section">
    <h3>Summary</h3>
    <p>${this.escapeHtml(explanation.summary)}</p>
  </div>
  ${explanation.whyItMatters ? `<div class="section">
    <h3>Why It Matters</h3>
    <p>${this.escapeHtml(explanation.whyItMatters)}</p>
  </div>` : ''}
  ${explanation.howToFix ? `<div class="section">
    <h3>How to Fix</h3>
    <p>${this.escapeHtml(explanation.howToFix)}</p>
  </div>` : ''}
  ${codeBlock}
</body>
</html>`;
  }

  private showMigrationPlanPanel(params: AiMigrationParams, plan: AiMigrationPlan): void {
    const fileName = path.basename(params.relativePath);
    const panel = vscode.window.createWebviewPanel(
      'adiMigrationPlan',
      `ADI: Migrate ${fileName}`,
      vscode.ViewColumn.Beside,
      { enableScripts: false }
    );

    const stepsHtml = plan.steps.map((s, i) => `<li>${this.escapeHtml(s)}</li>`).join('\n');
    const risksHtml = plan.risks.length > 0
      ? plan.risks.map(r => `<li>${this.escapeHtml(r)}</li>`).join('\n')
      : '<li>No significant risks identified.</li>';

    panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family, sans-serif); padding: 16px; color: var(--vscode-foreground); background: var(--vscode-editor-background); line-height: 1.6; }
    h2 { color: var(--vscode-textLink-foreground); margin-top: 0; }
    h3 { color: var(--vscode-textLink-foreground); margin-top: 20px; }
    .meta { opacity: 0.7; font-size: 0.9em; margin-bottom: 16px; }
    .effort { display: inline-block; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 2px 8px; border-radius: 4px; font-weight: bold; }
    ol { padding-left: 20px; }
    li { margin-bottom: 8px; }
    .risks { color: var(--vscode-editorWarning-foreground); }
  </style>
</head>
<body>
  <h2>Migration Plan: ${this.escapeHtml(params.target)}</h2>
  <div class="meta">${this.escapeHtml(fileName)}</div>
  <p>Estimated effort: <span class="effort">${this.escapeHtml(plan.estimatedEffort)}</span></p>
  <div>
    <h3>Steps</h3>
    <ol>${stepsHtml}</ol>
  </div>
  <div class="risks">
    <h3>Risks</h3>
    <ul>${risksHtml}</ul>
  </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private runAnalysisWithCache(index: ProjectIndex): AnalysisDiagnostic[] {
    const allDiagnostics: AnalysisDiagnostic[] = [];
    let cacheHits = 0;

    for (const file of index.files) {
      // Check cache
      const cached = this.analysisCache.get(file.relativePath, file.content);
      if (cached) {
        allDiagnostics.push(...cached);
        cacheHits++;
        continue;
      }

      // Run analysis
      const fileDiagnostics = this.registry.runForFile(file, index);
      this.analysisCache.set(file.relativePath, file.content, fileDiagnostics);
      allDiagnostics.push(...fileDiagnostics);
    }

    if (cacheHits > 0) {
      log(`Cache: ${cacheHits} files skipped (unchanged)`);
    }

    return allDiagnostics;
  }

  private calculateHealthScore(): number {
    if (!this.currentIndex || this.currentIndex.stats.fileCount === 0) {
      return 100;
    }

    // Only errors and warnings meaningfully affect health score.
    // Info and hints are suggestions, not problems.
    let weightedIssues = 0;
    for (const diag of this.lastDiagnostics) {
      switch (diag.severity) {
        case 'error': weightedIssues += 5.0; break;
        case 'warning': weightedIssues += 1.0; break;
        case 'info': weightedIssues += 0.05; break;
        case 'hint': weightedIssues += 0; break;
      }
    }

    // Ratio of weighted issues to analyzable files
    const analyzableFiles = Math.max(
      this.currentIndex.stats.componentCount + this.currentIndex.stats.serviceCount + this.currentIndex.stats.directiveCount,
      1
    );
    const issueRatio = weightedIssues / analyzableFiles;

    // Exponential decay: 0 issues = 100, ~1 per file = 85, ~3 = 61, ~10 = 19
    const score = Math.round(100 * Math.exp(-issueRatio / 6));
    return Math.max(0, Math.min(100, score));
  }

  private clearDiagnostics(): void {
    this.diagnosticsManager.clear();
    this.lastDiagnostics = [];
    this.analysisCache.clear();
    this.healthScore = 0;
    const emptyStats = this.currentIndex?.stats ?? { fileCount: 0, componentCount: 0, serviceCount: 0, routeCount: 0, htmlCount: 0, styleCount: 0, pipeCount: 0, directiveCount: 0, moduleCount: 0 };
    this.statusBar.updateWithScore(this.healthScore,[], emptyStats);
    this.treeDataProvider.clear();
    vscode.window.showInformationMessage('ADI: Diagnostics cleared.');
  }

  private showSuggestion(message: string): void {
    vscode.window.showInformationMessage(message, { modal: true });
  }

  private async selectAiModel(): Promise<void> {
    interface ProviderPickItem extends vscode.QuickPickItem {
      providerType?: 'chat' | 'lm';
      providerId?: string;
      modelId?: string;
    }

    const config = vscode.workspace.getConfiguration('adi');
    const items: ProviderPickItem[] = [];

    // Section 1: Installed chat extensions
    const chatProviders = getInstalledProviders();
    const currentChatId = config.get<string>('chatProvider');
    if (chatProviders.length > 0) {
      items.push({ label: 'Chat Extensions', kind: vscode.QuickPickItemKind.Separator });
      for (const p of chatProviders) {
        const isCurrent = p.id === currentChatId;
        const method = p.queryFormat === 'object'
          ? 'Opens chat with prompt pre-filled'
          : 'Opens chat + copies prompt to clipboard';
        items.push({
          label: `${isCurrent ? '$(check) ' : ''}${p.name}`,
          description: isCurrent ? 'current' : '',
          detail: method,
          providerType: 'chat',
          providerId: p.id,
        });
      }
    }

    // Section 2: VS Code LM API models (Copilot, etc.)
    let lmModels: vscode.LanguageModelChat[] = [];
    try {
      lmModels = await vscode.lm.selectChatModels();
    } catch { /* LM API not available */ }

    if (lmModels.length > 0) {
      items.push({ label: 'Language Models (inline response)', kind: vscode.QuickPickItemKind.Separator });
      const currentModelId = config.get<string>('aiModel');
      for (const m of lmModels) {
        const isCurrent = m.id === currentModelId;
        items.push({
          label: `${isCurrent ? '$(check) ' : ''}${m.name}`,
          description: isCurrent ? 'current' : m.family,
          detail: `${m.vendor} - responds inline via VS Code LM API`,
          providerType: 'lm',
          modelId: m.id,
        });
      }
    }

    if (items.length === 0) {
      vscode.window.showWarningMessage('ADI: No AI providers found. Install a chat extension (Copilot, Cline, Continue) or set adi.claudeApiKey.');
      return;
    }

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select AI provider for ADI',
      title: 'Angular Deep Intelligence - Select AI Provider',
      ignoreFocusOut: true,
    });

    if (!picked || !picked.providerType) {
      return;
    }

    if (picked.providerType === 'chat' && picked.providerId) {
      await config.update('chatProvider', picked.providerId, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`ADI: Now using ${picked.label} for AI actions.`);
    } else if (picked.providerType === 'lm' && picked.modelId) {
      await config.update('aiModel', picked.modelId, vscode.ConfigurationTarget.Global);
      await config.update('chatProvider', 'auto', vscode.ConfigurationTarget.Global);
      if (this.aiProvider instanceof VsCodeLmProvider) {
        await this.aiProvider.selectModel();
      }
      vscode.window.showInformationMessage(`ADI: Now using ${picked.label} for AI actions.`);
    }
  }

  async showDependencyGraph(): Promise<void> {
    if (!this.currentIndex) {
      const action = await vscode.window.showWarningMessage(
        'ADI: No scan results yet. Run a scan first?',
        'Scan Now'
      );
      if (action === 'Scan Now') {
        await this.scanProject();
      }
      if (!this.currentIndex) return;
    }

    const graph = extractDependencyGraph(this.currentIndex);

    if (graph.nodes.length === 0) {
      vscode.window.showInformationMessage('ADI: No injectable dependencies found in the project.');
      return;
    }

    DependencyGraphPanel.show(graph);

    const circularNote = graph.circularChains.length > 0
      ? ` (${graph.circularChains.length} circular chain${graph.circularChains.length > 1 ? 's' : ''} detected)`
      : '';
    log(`Dependency graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges${circularNote}`);
  }

  private buildSummary(elapsedMs?: number): string {
    if (!this.currentIndex) {
      return 'ADI: No scan results.';
    }

    const s = this.currentIndex.stats;
    const d = this.lastDiagnostics;
    const errors = d.filter(x => x.severity === 'error').length;
    const warnings = d.filter(x => x.severity === 'warning').length;
    const infos = d.filter(x => x.severity === 'info').length;
    const hints = d.filter(x => x.severity === 'hint').length;
    const time = elapsedMs ? ` in ${(elapsedMs / 1000).toFixed(1)}s` : '';

    const parts: string[] = [];
    if (errors > 0) parts.push(`${errors} errors`);
    if (warnings > 0) parts.push(`${warnings} warnings`);
    if (infos > 0) parts.push(`${infos} info`);
    if (hints > 0) parts.push(`${hints} hints`);

    return `ADI: Scanned ${s.fileCount} files (${s.componentCount} components, ${s.serviceCount} services). Found: ${parts.join(', ')}${time}. Health: ${this.healthScore}/100.`;
  }
}
