import { SourceFile } from 'ts-morph';
import * as path from 'path';
import { normalizeRelativePath } from '../utils/path-utils';
import { getDecoratorByName, getDecoratorPropertyValue } from '../utils/ast-helpers';

export function extractTemplateLink(
  sourceFile: SourceFile,
  relativePath: string,
  rootPath: string
): string | null {
  const componentDecorator = getDecoratorByName(sourceFile, 'Component');
  if (!componentDecorator) {
    return null;
  }

  const templateUrlValue = getDecoratorPropertyValue(componentDecorator, 'templateUrl');
  if (!templateUrlValue) {
    return null;
  }

  // Remove quotes from the value
  const templateUrl = templateUrlValue.replace(/['"]/g, '');
  if (!templateUrl) {
    return null;
  }

  const sourceAbsolutePath = path.join(rootPath, relativePath);
  const candidateAbsolutePath = path.resolve(path.dirname(sourceAbsolutePath), templateUrl);
  return normalizeRelativePath(path.relative(rootPath, candidateAbsolutePath));
}
