import * as vscode from 'vscode';
import * as https from 'https';
import { AiProvider, AiExplanation, AiMigrationPlan } from './ai-provider';
import { AiCache } from './ai-cache';
import { AnalysisDiagnostic } from '../analyzers/analyzer.types';
import { buildExplainPrompt, buildMigrationPrompt } from './prompt-templates';
import { parseExplanation, parseMigrationPlan } from './response-parser';
import { log, logError } from '../utils/logger';

export class ClaudeProvider implements AiProvider {
  readonly name = 'Claude';
  private cache = new AiCache();

  get isConfigured(): boolean {
    return !!this.getApiKey();
  }

  async explainDiagnostic(diagnostic: AnalysisDiagnostic, fileContent: string): Promise<AiExplanation> {
    // Check cache first
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
    const response = await this.callApi(prompt);
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
    const response = await this.callApi(prompt);
    const plan = parseMigrationPlan(response);

    this.cache.setMigrationPlan(fileContent, targetPattern, plan);
    return plan;
  }

  private getApiKey(): string | undefined {
    return vscode.workspace.getConfiguration('adi').get<string>('claudeApiKey');
  }

  private callApi(prompt: string): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return Promise.reject(new Error('Claude API key not configured. Set adi.claudeApiKey in settings.'));
    }

    log('Calling Claude API...');

    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              logError('Claude API error', parsed.error.message);
              reject(new Error(parsed.error.message));
              return;
            }
            const text = parsed.content?.[0]?.text || '';
            resolve(text);
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', (err) => {
        logError('Claude API request failed', err);
        reject(err);
      });

      req.write(body);
      req.end();
    });
  }
}
