import * as crypto from 'crypto';

export class FileCache<T> {
  private cache = new Map<string, { hash: string; data: T }>();

  get(filePath: string, content: string): T | undefined {
    const hash = this.hashContent(content);
    const entry = this.cache.get(filePath);
    if (entry && entry.hash === hash) {
      return entry.data;
    }
    return undefined;
  }

  set(filePath: string, content: string, data: T): void {
    const hash = this.hashContent(content);
    this.cache.set(filePath, { hash, data });
  }

  invalidate(filePath: string): void {
    this.cache.delete(filePath);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  private hashContent(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }
}
