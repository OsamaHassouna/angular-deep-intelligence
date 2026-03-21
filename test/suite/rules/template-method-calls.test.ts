import * as assert from 'assert';
import { templateMethodCallsRule } from '../../../src/analyzers/rules/template-method-calls';
import { AngularFile, ProjectIndex } from '../../../src/scanner/project-model';

function makeComponent(tsContent: string, templateContent: string, useExternal = false): { file: AngularFile; index: ProjectIndex } {
  const files: AngularFile[] = [];

  if (useExternal) {
    const templateFile: AngularFile = {
      relativePath: 'src/app/test.component.html',
      uri: 'file:///src/app/test.component.html',
      extension: '.html',
      sizeBytes: templateContent.length,
      lineCount: templateContent.split('\n').length,
      artifactType: 'template',
      linkedTemplatePath: null,
      imports: { raw: [], resolved: [] },
      content: templateContent,
    };
    files.push(templateFile);

    const componentFile: AngularFile = {
      relativePath: 'src/app/test.component.ts',
      uri: 'file:///src/app/test.component.ts',
      extension: '.ts',
      sizeBytes: tsContent.length,
      lineCount: tsContent.split('\n').length,
      artifactType: 'component',
      linkedTemplatePath: 'src/app/test.component.html',
      imports: { raw: [], resolved: [] },
      content: tsContent,
    };
    files.push(componentFile);
  } else {
    const componentFile: AngularFile = {
      relativePath: 'src/app/test.component.ts',
      uri: 'file:///src/app/test.component.ts',
      extension: '.ts',
      sizeBytes: tsContent.length,
      lineCount: tsContent.split('\n').length,
      artifactType: 'component',
      linkedTemplatePath: null,
      imports: { raw: [], resolved: [] },
      content: tsContent,
    };
    files.push(componentFile);
  }

  const fileMap = new Map<string, AngularFile>();
  for (const f of files) fileMap.set(f.relativePath, f);

  const index: ProjectIndex = {
    rootPath: '/project', files, fileMap,
    stats: { fileCount: files.length, componentCount: 1, serviceCount: 0, routeCount: 0, htmlCount: 0, styleCount: 0, pipeCount: 0, directiveCount: 0, moduleCount: 0 },
    scannedAt: Date.now(),
  };

  const componentFile = files.find(f => f.artifactType === 'component')!;
  return { file: componentFile, index };
}

suite('Rule: template-method-calls', () => {
  test('should detect interpolation method call', () => {
    const { file, index } = makeComponent(
      `@Component({ selector: 'app-test', templateUrl: './test.component.html' })
export class TestComponent { getLabel() { return 'hi'; } }`,
      `<p>{{ getLabel() }}</p>`,
      true
    );
    const d = templateMethodCallsRule.analyze(file, index);
    assert.ok(d.length > 0, 'Should detect {{ getLabel() }}');
    assert.ok(d[0].message.includes('getLabel'));
  });

  test('should detect method call in *ngIf', () => {
    const { file, index } = makeComponent(
      `@Component({ selector: 'app-test', templateUrl: './test.component.html' })
export class TestComponent { isVisible() { return true; } }`,
      `<div *ngIf="isVisible()">visible</div>`,
      true
    );
    const d = templateMethodCallsRule.analyze(file, index);
    assert.ok(d.length > 0, 'Should detect *ngIf="isVisible()"');
  });

  test('should detect method call in *ngFor', () => {
    const { file, index } = makeComponent(
      `@Component({ selector: 'app-test', templateUrl: './test.component.html' })
export class TestComponent { getItems() { return []; } }`,
      `<li *ngFor="let item of getItems()">{{ item }}</li>`,
      true
    );
    const d = templateMethodCallsRule.analyze(file, index);
    assert.ok(d.length > 0, 'Should detect *ngFor="let item of getItems()"');
  });

  test('should skip async pipe lines', () => {
    const { file, index } = makeComponent(
      `@Component({ selector: 'app-test', templateUrl: './test.component.html' })
export class TestComponent { getData() { return of([]); } }`,
      `<p>{{ getData() | async }}</p>`,
      true
    );
    const d = templateMethodCallsRule.analyze(file, index);
    assert.strictEqual(d.length, 0, 'Should skip async pipe');
  });

  test('should detect inline template method calls', () => {
    const content = `@Component({
  selector: 'app-test',
  template: \`<p>{{ computeTotal() }}</p>\`
})
export class TestComponent { computeTotal() { return 0; } }`;
    const { file, index } = makeComponent(content, '', false);
    const d = templateMethodCallsRule.analyze(file, index);
    assert.ok(d.length > 0, 'Should detect inline template method call');
  });
});
