import * as assert from 'assert';
import { AnalyzerRegistry } from '../../../src/analyzers/analyzer-registry';
import { AngularFile, ProjectIndex, ProjectStats } from '../../../src/scanner/project-model';
import { classifyArtifact } from '../../../src/scanner/artifact-classifier';
import { Project } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Integration test: Runs full analysis pipeline against fixture projects.
 * Uses direct fs reads instead of vscode.workspace.fs (test environment).
 */

function scanFixtureProject(fixtureName: string): ProjectIndex {
  const rootPath = path.resolve(__dirname, '../../../../test/fixtures', fixtureName);
  const files: AngularFile[] = [];
  const tsMorphProject = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', '.angular'].includes(entry.name)) continue;
        walk(abs);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!['.ts', '.html', '.scss', '.css'].includes(ext)) continue;
      if (entry.name.endsWith('.spec.ts')) continue;

      const rel = path.relative(rootPath, abs).split(path.sep).join('/');
      const content = fs.readFileSync(abs, 'utf8');
      const lineCount = content.split('\n').length;

      let sourceFile = null;
      if (ext === '.ts') {
        try {
          sourceFile = tsMorphProject.createSourceFile(`__scan__/${rel}`, content, { overwrite: true });
        } catch { /* skip */ }
      }

      const artifactType = classifyArtifact(rel, sourceFile);

      files.push({
        relativePath: rel,
        uri: `file:///${abs.split(path.sep).join('/')}`,
        extension: ext,
        sizeBytes: content.length,
        lineCount,
        artifactType,
        linkedTemplatePath: null, // Simplified for test
        imports: { raw: [], resolved: [] },
        content,
      });
    }
  }

  walk(rootPath);

  const fileMap = new Map<string, AngularFile>();
  for (const f of files) fileMap.set(f.relativePath, f);

  const stats: ProjectStats = {
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

  return { rootPath, files, fileMap, stats, scannedAt: Date.now() };
}

suite('Integration: Full Scan', () => {
  test('should scan anti-pattern-samples and find issues', () => {
    const index = scanFixtureProject('anti-pattern-samples');
    const registry = new AnalyzerRegistry();
    const diagnostics = registry.runAll(index);

    // Should find at least: subscribe leaks + missing onpush
    assert.ok(diagnostics.length > 0, `Expected diagnostics, got ${diagnostics.length}`);

    const ruleIds = new Set(diagnostics.map(d => d.ruleId));
    assert.ok(ruleIds.has('missing-unsubscribe'), 'Should detect missing unsubscribe');
    assert.ok(ruleIds.has('missing-onpush'), 'Should detect missing onpush');
  });

  test('should scan clean-samples and find minimal issues', () => {
    const index = scanFixtureProject('clean-samples');
    const registry = new AnalyzerRegistry();
    const diagnostics = registry.runAll(index);

    // Clean samples should have no missing-unsubscribe warnings
    const unsubscribeDiags = diagnostics.filter(d => d.ruleId === 'missing-unsubscribe');
    assert.strictEqual(unsubscribeDiags.length, 0, 'Clean samples should have no subscribe leaks');
  });

  test('should correctly classify artifacts in standalone-transactions', () => {
    const index = scanFixtureProject('standalone-transactions');

    assert.ok(index.stats.fileCount > 0, 'Should find files');
    assert.ok(index.stats.componentCount > 0, 'Should find components');

    // Verify classification
    for (const file of index.files) {
      if (file.relativePath.endsWith('.component.ts')) {
        assert.strictEqual(file.artifactType, 'component', `${file.relativePath} should be component`);
      }
      if (file.relativePath.endsWith('.service.ts')) {
        assert.strictEqual(file.artifactType, 'service', `${file.relativePath} should be service`);
      }
      if (file.relativePath.endsWith('.html')) {
        assert.strictEqual(file.artifactType, 'template', `${file.relativePath} should be template`);
      }
    }
  });

  test('should handle feature-orders-module (module-based project)', () => {
    const index = scanFixtureProject('feature-orders-module');

    assert.ok(index.stats.fileCount > 0, 'Should find files');
    // Module-based project should have modules detected
    const modules = index.files.filter(f => f.artifactType === 'module');
    assert.ok(modules.length > 0, 'Should find NgModules in module-based project');
  });

  test('should handle mixed-admin-console', () => {
    const index = scanFixtureProject('mixed-admin-console');

    assert.ok(index.stats.fileCount > 0, 'Should find files');
    assert.ok(index.stats.componentCount > 0, 'Should find components');
  });
});
