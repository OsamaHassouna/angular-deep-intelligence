import * as vscode from 'vscode';
import * as path from 'path';
import { Project, SourceFile } from 'ts-morph';
import { AngularFile, ProjectIndex, ProjectStats, FileImports } from './project-model';
import { classifyArtifact } from './artifact-classifier';
import { extractImports, emptyImports } from './import-resolver';
import { extractTemplateLink } from './template-linker';
import { normalizeRelativePath } from '../utils/path-utils';
import { log, logError } from '../utils/logger';
import { getConfig } from '../utils/config';

const IGNORED_DIRS = new Set([
  '.angular',
  '.git',
  '.idea',
  '.vscode',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'tmp',
  'e2e',
  '.nx',
]);

const ALLOWED_EXTENSIONS = new Set(['.ts', '.html', '.scss', '.css']);

export class WorkspaceScanner {
  private tsMorphProject: Project | null = null;

  async scan(rootUri: vscode.Uri): Promise<ProjectIndex> {
    const rootPath = rootUri.fsPath;
    log(`Scanning workspace: ${rootPath}`);

    const startTime = Date.now();
    const files: AngularFile[] = [];

    // Initialize ts-morph project for AST analysis
    this.tsMorphProject = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      compilerOptions: {
        allowJs: false,
        skipLibCheck: true,
      },
    });

    await this.scanDirectory(rootPath, rootPath, files);

    const fileMap = new Map<string, AngularFile>();
    for (const file of files) {
      fileMap.set(file.relativePath, file);
    }

    // Validate resolved imports against actual file map
    for (const file of files) {
      file.imports.resolved = file.imports.resolved.filter(imp => fileMap.has(imp));
    }

    const stats = buildProjectStats(files);
    const elapsed = Date.now() - startTime;
    log(`Scan complete: ${stats.fileCount} files in ${elapsed}ms`);
    log(`  Components: ${stats.componentCount}, Services: ${stats.serviceCount}, Modules: ${stats.moduleCount}`);

    // Clean up ts-morph project
    this.tsMorphProject = null;

    return {
      rootPath,
      files,
      fileMap,
      stats,
      scannedAt: Date.now(),
    };
  }

  private async scanDirectory(rootPath: string, currentPath: string, files: AngularFile[]): Promise<void> {
    const dirUri = vscode.Uri.file(currentPath);

    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(dirUri);
    } catch {
      logError(`Cannot read directory: ${currentPath}`);
      return;
    }

    const config = getConfig();
    const excludePatterns = config.excludePaths;

    for (const [name, type] of entries) {
      const absolutePath = path.join(currentPath, name);
      const relativePath = normalizeRelativePath(path.relative(rootPath, absolutePath));

      if (type === vscode.FileType.Directory) {
        if (IGNORED_DIRS.has(name)) {
          continue;
        }
        await this.scanDirectory(rootPath, absolutePath, files);
        continue;
      }

      if (type !== vscode.FileType.File) {
        continue;
      }

      const extension = path.extname(name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        continue;
      }

      if (relativePath.endsWith('.spec.ts') || relativePath.endsWith('.test.ts')) {
        continue;
      }

      // Check exclude patterns
      if (excludePatterns.some(pattern => relativePath.includes(pattern))) {
        continue;
      }

      try {
        const fileUri = vscode.Uri.file(absolutePath);
        const contentBytes = await vscode.workspace.fs.readFile(fileUri);
        const content = Buffer.from(contentBytes).toString('utf8');
        const lineCount = content.split('\n').length;

        let sourceFile: SourceFile | null = null;
        let imports: FileImports = emptyImports();
        let linkedTemplatePath: string | null = null;

        if (extension === '.ts' && this.tsMorphProject) {
          try {
            sourceFile = this.tsMorphProject.createSourceFile(
              `__scan__/${relativePath}`,
              content,
              { overwrite: true }
            );
            imports = extractImports(sourceFile, relativePath, rootPath);
          } catch {
            logError(`Failed to parse: ${relativePath}`);
          }
        }

        const artifactType = classifyArtifact(relativePath, sourceFile);

        if (artifactType === 'component' && sourceFile) {
          linkedTemplatePath = extractTemplateLink(sourceFile, relativePath, rootPath);
        }

        const stat = await vscode.workspace.fs.stat(fileUri);

        files.push({
          relativePath,
          uri: fileUri.toString(),
          extension,
          sizeBytes: stat.size,
          lineCount,
          artifactType,
          linkedTemplatePath,
          imports,
          content,
        });
      } catch (err) {
        logError(`Failed to process: ${relativePath}`, err);
      }
    }
  }
}

function buildProjectStats(files: AngularFile[]): ProjectStats {
  return {
    fileCount: files.length,
    componentCount: files.filter(f => f.artifactType === 'component').length,
    serviceCount: files.filter(f => f.artifactType === 'service').length,
    routeCount: files.filter(f => f.artifactType === 'route').length,
    htmlCount: files.filter(f => f.extension === '.html').length,
    styleCount: files.filter(f => f.artifactType === 'style').length,
    pipeCount: files.filter(f => f.artifactType === 'pipe').length,
    directiveCount: files.filter(f => f.artifactType === 'directive').length,
    moduleCount: files.filter(f => f.artifactType === 'module').length,
  };
}
