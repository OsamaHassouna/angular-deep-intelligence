import * as vscode from 'vscode';
import { AiProvider, AiExplanation, AiMigrationPlan } from './ai-provider';
import { AiCache } from './ai-cache';
import { AnalysisDiagnostic } from '../analyzers/analyzer.types';
import { buildExplainPrompt, buildMigrationPrompt } from './prompt-templates';
import { parseExplanation, parseMigrationPlan } from './response-parser';
import { log, logError } from '../utils/logger';

export class VsCodeLmProvider implements AiProvider {
  readonly name = 'VS Code Chat';
  private cache = new AiCache();
  private model: vscode.LanguageModelChat | undefined;

  get isConfigured(): boolean {
    return true;
  }

  /** Let the user pick from all available chat models via quick pick. */
  async selectModel(): Promise<boolean> {
    const models = await vscode.lm.selectChatModels();
    if (models.length === 0) {
      vscode.window.showWarningMessage('ADI: No AI chat models available. Install GitHub Copilot, Claude, or another AI extension.');
      return false;
    }

    // Clear current model so promptModelSelection runs fresh
    this.model = undefined;
    const picked = await this.promptModelSelection(models);
    if (picked) {
      vscode.window.showInformationMessage(`ADI: Now using ${picked.name}`);
      return true;
    }
    return false;
  }

  async explainDiagnostic(diagnostic: AnalysisDiagnostic, fileContent: string): Promise<AiExplanation> {
    const cached = this.cache.getExplanation(
      diagnostic.ruleId,
      fileContent,
      diagnostic.location.line
    );
    if (cached) {
      log('AI explanation served from cache');
      return cached;
    }

    const prompt = buildExplainPrompt(diagnostic, fileContent);
    const response = await this.sendRequest(prompt);
    const explanation = parseExplanation(response, diagnostic.suggestion);

    this.cache.setExplanation(
      diagnostic.ruleId,
      fileContent,
      diagnostic.location.line,
      explanation
    );
    return explanation;
  }

  async generateMigrationPlan(fileContent: string, targetPattern: string): Promise<AiMigrationPlan> {
    const cached = this.cache.getMigrationPlan(fileContent, targetPattern);
    if (cached) {
      log('AI migration plan served from cache');
      return cached;
    }

    const prompt = buildMigrationPrompt(fileContent, targetPattern);
    const response = await this.sendRequest(prompt);
    const plan = parseMigrationPlan(response);

    this.cache.setMigrationPlan(fileContent, targetPattern, plan);
    return plan;
  }

  private async resolveModel(): Promise<vscode.LanguageModelChat> {
    if (this.model) {
      return this.model;
    }

    const models = await vscode.lm.selectChatModels();

    if (models.length === 0) {
      throw new Error(
        'No AI chat models available in VS Code. Install GitHub Copilot or another AI extension, or configure adi.claudeApiKey for direct API access.'
      );
    }

    // Check if user has a saved preference
    const preferredId = vscode.workspace.getConfiguration('adi').get<string>('aiModel');
    if (preferredId && preferredId !== 'auto') {
      const preferred = models.find(m => m.id === preferredId);
      if (preferred) {
        this.model = preferred;
        log(`AI using saved model: ${preferred.name} (${preferred.family})`);
        return this.model;
      }
      log(`Saved model "${preferredId}" not found, prompting user`);
    }

    // Multiple models available and no saved preference: let the user choose
    if (models.length > 1) {
      const picked = await this.promptModelSelection(models);
      if (picked) {
        return picked;
      }
      // User cancelled the picker - fall through to auto-select
    }

    // Single model or user cancelled: use the only one available
    this.model = models[0];
    log(`AI using: ${this.model.name} (${this.model.family})`);
    return this.model;
  }

  private async promptModelSelection(models: vscode.LanguageModelChat[]): Promise<vscode.LanguageModelChat | undefined> {
    const items = models.map(m => ({
      label: m.name,
      description: m.family,
      detail: `${m.vendor} - ${m.id}`,
      model: m,
    }));

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Which AI model should ADI use?',
      title: 'Angular Deep Intelligence - Select AI Model',
      ignoreFocusOut: true,
    });

    if (picked) {
      this.model = picked.model;
      await vscode.workspace.getConfiguration('adi').update('aiModel', picked.model.id, vscode.ConfigurationTarget.Global);
      log(`AI model selected: ${picked.model.name} (${picked.model.family})`);
      return this.model;
    }

    return undefined;
  }

  private async sendRequest(prompt: string): Promise<string> {
    const model = await this.resolveModel();

    log(`Sending request to ${model.name}...`);

    const messages = [
      vscode.LanguageModelChatMessage.User(prompt),
    ];

    const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

    let text = '';
    for await (const chunk of response.text) {
      text += chunk;
    }

    log(`Raw AI response (${text.length} chars): ${text.slice(0, 100)}...`);
    return text;
  }
}
