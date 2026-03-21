import * as assert from 'assert';
import { missingOnPushRule } from '../../../src/analyzers/rules/missing-onpush';
import { AngularFile, ProjectIndex } from '../../../src/scanner/project-model';

function makeFile(content: string, overrides: Partial<AngularFile> = {}): AngularFile {
  return {
    relativePath: 'src/app/test.component.ts',
    uri: 'file:///src/app/test.component.ts',
    extension: '.ts',
    sizeBytes: content.length,
    lineCount: content.split('\n').length,
    artifactType: 'component',
    linkedTemplatePath: null,
    imports: { raw: [], resolved: [] },
    content,
    ...overrides,
  };
}

function makeIndex(files: AngularFile[] = []): ProjectIndex {
  const fileMap = new Map<string, AngularFile>();
  for (const f of files) {
    fileMap.set(f.relativePath, f);
  }
  return {
    rootPath: '/project',
    files,
    fileMap,
    stats: {
      fileCount: files.length,
      componentCount: files.filter(f => f.artifactType === 'component').length,
      serviceCount: 0,
      routeCount: 0,
      htmlCount: 0,
      styleCount: 0,
      pipeCount: 0,
      directiveCount: 0,
      moduleCount: 0,
    },
    scannedAt: Date.now(),
  };
}

suite('Rule: missing-onpush', () => {
  test('should detect component without OnPush', () => {
    const content = `
import { Component } from '@angular/core';
@Component({
  selector: 'app-test',
  template: '<p>hello</p>',
})
export class TestComponent {}`;
    const file = makeFile(content);
    const diagnostics = missingOnPushRule.analyze(file, makeIndex([file]));
    assert.ok(diagnostics.length > 0, 'Should detect missing OnPush');
  });

  test('should NOT flag component with OnPush', () => {
    const content = `
import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-test',
  template: '<p>hello</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestComponent {}`;
    const file = makeFile(content);
    const diagnostics = missingOnPushRule.analyze(file, makeIndex([file]));
    assert.strictEqual(diagnostics.length, 0, 'Should not flag OnPush component');
  });

  test('should skip non-component files', () => {
    const content = `
import { Injectable } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class TestService {}`;
    const file = makeFile(content, { artifactType: 'service' });
    const diagnostics = missingOnPushRule.analyze(file, makeIndex([file]));
    assert.strictEqual(diagnostics.length, 0, 'Should skip services');
  });

  test('should flag leaf components as warning', () => {
    const content = `
import { Component } from '@angular/core';
@Component({
  selector: 'app-leaf',
  template: '<span>{{ value }}</span>',
})
export class LeafComponent {
  value = 'test';
}`;
    const file = makeFile(content);
    const diagnostics = missingOnPushRule.analyze(file, makeIndex([file]));
    assert.ok(diagnostics.length > 0);
    assert.strictEqual(diagnostics[0].severity, 'info', 'Leaf components should be info severity');
  });

  test('should flag parent components as info', () => {
    const childContent = `
import { Component } from '@angular/core';
@Component({ selector: 'app-child', template: '<span>child</span>' })
export class ChildComponent {}`;
    const childFile = makeFile(childContent, {
      relativePath: 'src/app/child.component.ts',
      uri: 'file:///src/app/child.component.ts',
    });

    const templateFile: AngularFile = {
      relativePath: 'src/app/parent.component.html',
      uri: 'file:///src/app/parent.component.html',
      extension: '.html',
      sizeBytes: 50,
      lineCount: 3,
      artifactType: 'template',
      linkedTemplatePath: null,
      imports: { raw: [], resolved: [] },
      content: '<div><app-child></app-child></div>',
    };

    const parentContent = `
import { Component } from '@angular/core';
@Component({
  selector: 'app-parent',
  templateUrl: './parent.component.html',
})
export class ParentComponent {}`;
    const parentFile = makeFile(parentContent, {
      relativePath: 'src/app/parent.component.ts',
      uri: 'file:///src/app/parent.component.ts',
      linkedTemplatePath: 'src/app/parent.component.html',
    });

    const index = makeIndex([childFile, parentFile, templateFile]);
    const diagnostics = missingOnPushRule.analyze(parentFile, index);
    assert.ok(diagnostics.length > 0);
    assert.strictEqual(diagnostics[0].severity, 'hint', 'Parent components should be hint severity');
  });
});
