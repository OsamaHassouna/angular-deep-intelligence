import * as assert from 'assert';
import { classifyArtifact } from '../../src/scanner/artifact-classifier';
import { extractTemplateLink } from '../../src/scanner/template-linker';
import { resolveImportPath, emptyImports } from '../../src/scanner/import-resolver';
import { Project } from 'ts-morph';

suite('Scanner: Artifact Classifier', () => {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  test('should classify .html as template', () => {
    assert.strictEqual(classifyArtifact('src/app/test.component.html', null), 'template');
  });

  test('should classify .scss as style', () => {
    assert.strictEqual(classifyArtifact('src/app/test.component.scss', null), 'style');
  });

  test('should classify .css as style', () => {
    assert.strictEqual(classifyArtifact('src/app/test.component.css', null), 'style');
  });

  test('should classify @Component via AST', () => {
    const sf = project.createSourceFile('__test__/comp.ts', `
      import { Component } from '@angular/core';
      @Component({ selector: 'app-test', template: '' })
      export class TestComponent {}
    `, { overwrite: true });
    assert.strictEqual(classifyArtifact('src/app/test.component.ts', sf), 'component');
  });

  test('should classify @Injectable via AST', () => {
    const sf = project.createSourceFile('__test__/svc.ts', `
      import { Injectable } from '@angular/core';
      @Injectable({ providedIn: 'root' })
      export class TestService {}
    `, { overwrite: true });
    assert.strictEqual(classifyArtifact('src/app/test.service.ts', sf), 'service');
  });

  test('should classify @Directive via AST', () => {
    const sf = project.createSourceFile('__test__/dir.ts', `
      import { Directive } from '@angular/core';
      @Directive({ selector: '[appTest]' })
      export class TestDirective {}
    `, { overwrite: true });
    assert.strictEqual(classifyArtifact('src/app/test.directive.ts', sf), 'directive');
  });

  test('should classify @Pipe via AST', () => {
    const sf = project.createSourceFile('__test__/pipe.ts', `
      import { Pipe, PipeTransform } from '@angular/core';
      @Pipe({ name: 'testPipe' })
      export class TestPipe implements PipeTransform {
        transform(value: any): any { return value; }
      }
    `, { overwrite: true });
    assert.strictEqual(classifyArtifact('src/app/test.pipe.ts', sf), 'pipe');
  });

  test('should classify @NgModule via AST', () => {
    const sf = project.createSourceFile('__test__/mod.ts', `
      import { NgModule } from '@angular/core';
      @NgModule({ declarations: [], imports: [] })
      export class TestModule {}
    `, { overwrite: true });
    assert.strictEqual(classifyArtifact('src/app/test.module.ts', sf), 'module');
  });

  test('should classify route files by filename', () => {
    assert.strictEqual(classifyArtifact('src/app/app.routes.ts', null), 'route');
    assert.strictEqual(classifyArtifact('src/app/app-routing.module.ts', null), 'route');
  });

  test('should default to source for plain .ts', () => {
    const sf = project.createSourceFile('__test__/util.ts', `
      export function helper() { return 42; }
    `, { overwrite: true });
    assert.strictEqual(classifyArtifact('src/app/utils/helper.ts', sf), 'source');
  });
});

suite('Scanner: Template Linker', () => {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  test('should extract templateUrl', () => {
    const sf = project.createSourceFile('__test__/tl.ts', `
      import { Component } from '@angular/core';
      @Component({
        selector: 'app-test',
        templateUrl: './test.component.html',
      })
      export class TestComponent {}
    `, { overwrite: true });
    const result = extractTemplateLink(sf, 'src/app/test.component.ts', '/project');
    assert.strictEqual(result, 'src/app/test.component.html');
  });

  test('should return null for inline template', () => {
    const sf = project.createSourceFile('__test__/tl2.ts', `
      import { Component } from '@angular/core';
      @Component({
        selector: 'app-test',
        template: '<p>hello</p>',
      })
      export class TestComponent {}
    `, { overwrite: true });
    const result = extractTemplateLink(sf, 'src/app/test.component.ts', '/project');
    assert.strictEqual(result, null);
  });
});

suite('Scanner: Import Resolver', () => {
  test('should resolve relative import paths', () => {
    const result = resolveImportPath(
      'src/app/components/test.component.ts',
      './test.service',
      '/project'
    );
    assert.strictEqual(result, 'src/app/components/test.service.ts');
  });

  test('should return null for package imports', () => {
    const result = resolveImportPath(
      'src/app/test.component.ts',
      '@angular/core',
      '/project'
    );
    assert.strictEqual(result, null);
  });

  test('should return null for rxjs imports', () => {
    const result = resolveImportPath(
      'src/app/test.component.ts',
      'rxjs/operators',
      '/project'
    );
    assert.strictEqual(result, null);
  });

  test('emptyImports should return empty arrays', () => {
    const result = emptyImports();
    assert.deepStrictEqual(result, { raw: [], resolved: [] });
  });
});
