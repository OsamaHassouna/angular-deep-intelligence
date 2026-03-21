import * as crypto from 'crypto';
import { AiExplanation, AiMigrationPlan } from './ai-provider';

interface CacheEntry<T> {
  hash: string;
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class AiCache {
  private explanations = new Map<string, CacheEntry<AiExplanation>>();
  private migrations = new Map<string, CacheEntry<AiMigrationPlan>>();

  getExplanation(ruleId: string, fileContent: string, line: number): AiExplanation | undefined {
    const key = this.makeKey(ruleId, fileContent, line);
    const entry = this.explanations.get(key);
    if (entry && !this.isExpired(entry)) {
      return entry.data;
    }
    return undefined;
  }

  setExplanation(ruleId: string, fileContent: string, line: number, data: AiExplanation): void {
    const key = this.makeKey(ruleId, fileContent, line);
    this.explanations.set(key, {
      hash: this.hashContent(fileContent),
      data,
      timestamp: Date.now(),
    });
  }

  getMigrationPlan(fileContent: string, target: string): AiMigrationPlan | undefined {
    const key = `migration:${this.hashContent(fileContent)}:${target}`;
    const entry = this.migrations.get(key);
    if (entry && !this.isExpired(entry)) {
      return entry.data;
    }
    return undefined;
  }

  setMigrationPlan(fileContent: string, target: string, data: AiMigrationPlan): void {
    const key = `migration:${this.hashContent(fileContent)}:${target}`;
    this.migrations.set(key, {
      hash: this.hashContent(fileContent),
      data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.explanations.clear();
    this.migrations.clear();
  }

  private makeKey(ruleId: string, fileContent: string, line: number): string {
    return `${ruleId}:${this.hashContent(fileContent)}:${line}`;
  }

  private hashContent(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private isExpired<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > CACHE_TTL_MS;
  }
}
