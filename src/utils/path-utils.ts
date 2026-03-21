import * as path from 'path';

export function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join('/');
}

export function getFeatureBucket(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  const match = normalized.match(/^src\/app\/(features|modules)\/([^/]+)/);

  if (match) {
    return `${match[1]}:${match[2]}`;
  }

  if (normalized.includes('/core/')) {
    return 'core';
  }

  if (normalized.includes('/shared/')) {
    return 'shared';
  }

  if (normalized.includes('/layout/')) {
    return 'layout';
  }

  return normalized.split('/').slice(0, 4).join('/');
}
