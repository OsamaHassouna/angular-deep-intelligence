import * as assert from 'assert';
import { standaloneReadinessRule } from '../../../src/analyzers/rules/standalone-readiness';
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

function makeIndex(files: AngularFile[]): ProjectIndex {
  const fileMap = new Map<string, AngularFile>();
  for (const f of files) fileMap.set(f.relativePath, f);
  return {
    rootPath: '/project', files, fileMap,
    stats: { fileCount: files.length, componentCount: 0, serviceCount: 0, routeCount: 0, htmlCount: 0, styleCount: 0, pipeCount: 0, directiveCount: 0, moduleCount: 0 },
    scannedAt: Date.now(),
  };
}

suite('Rule: standalone-readiness', () => {
  test('should score module-declared component', () => {
    const component = makeFile(`
@Component({ selector: 'app-test', template: '<p>hi</p>' })
export class TestComponent {}
`);
    const module = makeFile(`
@NgModule({
  declarations: [TestComponent],
  imports: [CommonModule, FormsModule],
})
export class TestModule {}
`, { relativePath: 'src/app/test.module.ts', uri: 'file:///src/app/test.module.ts', artifactType: 'module' });

    const d = standaloneReadinessRule.analyze(component, makeIndex([component, module]));
    assert.ok(d.length > 0, 'Should produce readiness score');
    assert.ok(d[0].message.includes('readiness'), 'Should mention readiness');
    assert.strictEqual(d[0].category, 'migration');
  });

  test('should skip already standalone components', () => {
    const content = `
@Component({ selector: 'app-test', template: '', standalone: true })
export class TestComponent {}
`;
    const d = standaloneReadinessRule.analyze(makeFile(content), makeIndex([makeFile(content)]));
    assert.strictEqual(d.length, 0, 'Should skip standalone components');
  });

  test('should skip components not in any module', () => {
    const content = `
@Component({ selector: 'app-test', template: '' })
export class TestComponent {}
`;
    const d = standaloneReadinessRule.analyze(makeFile(content), makeIndex([makeFile(content)]));
    assert.strictEqual(d.length, 0, 'Should skip orphaned components');
  });

  test('should mention module imports in suggestion', () => {
    const component = makeFile(`
@Component({ selector: 'app-test', template: '' })
export class TestComponent {}
`);
    const module = makeFile(`
@NgModule({
  declarations: [TestComponent],
  imports: [CommonModule, ReactiveFormsModule],
})
export class TestModule {}
`, { relativePath: 'src/app/test.module.ts', uri: 'file:///src/app/test.module.ts', artifactType: 'module' });

    const d = standaloneReadinessRule.analyze(component, makeIndex([component, module]));
    assert.ok(d.length > 0);
    assert.ok(d[0].suggestion?.includes('CommonModule'), 'Should mention CommonModule in suggestion');
  });
});
