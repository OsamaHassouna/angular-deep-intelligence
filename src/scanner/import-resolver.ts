import { SourceFile } from 'ts-morph';
import * as path from 'path';
import { FileImports } from './project-model';
import { normalizeRelativePath } from '../utils/path-utils';

export function extractImports(sourceFile: SourceFile, relativePath: string, rootPath: string): FileImports {
  const raw: string[] = [];
  const resolved: string[] = [];

  for (const importDecl of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    raw.push(moduleSpecifier);

    const resolvedPath = resolveImportPath(relativePath, moduleSpecifier, rootPath);
    if (resolvedPath) {
      resolved.push(resolvedPath);
    }
  }

  return { raw, resolved };
}

export function resolveImportPath(
  sourceRelativePath: string,
  importPath: string,
  rootPath: string
): string | null {
  if (!importPath.startsWith('.')) {
    return null;
  }

  const sourceAbsolutePath = path.join(rootPath, sourceRelativePath);
  const baseAbsolutePath = path.resolve(path.dirname(sourceAbsolutePath), importPath);
  const candidates = [
    `${baseAbsolutePath}.ts`,
    `${baseAbsolutePath}.html`,
    `${baseAbsolutePath}.scss`,
    `${baseAbsolutePath}.css`,
    path.join(baseAbsolutePath, 'index.ts'),
  ];

  // Use ts-morph's file system awareness instead of fs.existsSync
  // For now, resolve based on path patterns (validated during scan)
  for (const candidate of candidates) {
    const relativeCandidate = normalizeRelativePath(path.relative(rootPath, candidate));
    if (!relativeCandidate.startsWith('..')) {
      return relativeCandidate;
    }
  }

  return null;
}

export function emptyImports(): FileImports {
  return { raw: [], resolved: [] };
}
