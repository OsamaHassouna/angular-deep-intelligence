import * as assert from 'assert';
import { sharedModuleBloatRule } from '../../../src/analyzers/rules/shared-module-bloat';
import { AngularFile, ProjectIndex } from '../../../src/scanner/project-model';

function makeFile(content: string, overrides: Partial<AngularFile> = {}): AngularFile {
  return {
    relativePath: 'src/app/shared/shared.module.ts',
    uri: 'file:///src/app/shared/shared.module.ts',
    extension: '.ts',
    sizeBytes: content.length,
    lineCount: content.split('\n').length,
    artifactType: 'module',
    linkedTemplatePath: null,
    imports: { raw: [], resolved: [] },
    content,
    ...overrides,
  };
}

const emptyIndex: ProjectIndex = {
  rootPath: '/project', files: [], fileMap: new Map(),
  stats: { fileCount: 0, componentCount: 0, serviceCount: 0, routeCount: 0, htmlCount: 0, styleCount: 0, pipeCount: 0, directiveCount: 0, moduleCount: 0 },
  scannedAt: Date.now(),
};

function generateDeclarations(count: number): string {
  return Array.from({ length: count }, (_, i) => `Component${i}`).join(',\n    ');
}

suite('Rule: shared-module-bloat', () => {
  test('should flag SharedModule with >15 declarations', () => {
    const content = `
@NgModule({
  declarations: [
    ${generateDeclarations(20)}
  ],
  exports: [SomeComponent],
})
export class SharedModule {}`;
    const d = sharedModuleBloatRule.analyze(makeFile(content), emptyIndex);
    assert.ok(d.some(x => x.message.includes('20 declarations')), 'Should flag 20 declarations');
  });

  test('should flag SharedModule with >15 exports', () => {
    const content = `
@NgModule({
  declarations: [OneComponent],
  exports: [
    ${generateDeclarations(18)}
  ],
})
export class SharedModule {}`;
    const d = sharedModuleBloatRule.analyze(makeFile(content), emptyIndex);
    assert.ok(d.some(x => x.message.includes('18 items')), 'Should flag 18 exports');
  });

  test('should not flag small SharedModule', () => {
    const content = `
@NgModule({
  declarations: [ButtonComponent, CardComponent, BadgeComponent],
  exports: [ButtonComponent, CardComponent, BadgeComponent],
})
export class SharedModule {}`;
    const d = sharedModuleBloatRule.analyze(makeFile(content), emptyIndex);
    assert.strictEqual(d.length, 0, 'Should not flag small module');
  });

  test('should not flag non-shared modules', () => {
    const content = `
@NgModule({
  declarations: [
    ${generateDeclarations(20)}
  ],
})
export class OrdersModule {}`;
    const file = makeFile(content, {
      relativePath: 'src/app/features/orders/orders.module.ts',
    });
    const d = sharedModuleBloatRule.analyze(file, emptyIndex);
    assert.strictEqual(d.length, 0, 'Should skip non-shared modules');
  });

  test('should skip non-module files', () => {
    const content = `
@Component({ selector: 'test', template: '' })
export class TestComponent {}`;
    const file = makeFile(content, { artifactType: 'component' });
    const d = sharedModuleBloatRule.analyze(file, emptyIndex);
    assert.strictEqual(d.length, 0, 'Should skip components');
  });

  test('should flag heavy third-party module re-exports', () => {
    const content = `
@NgModule({
  imports: [
    CommonModule,
    MatButtonModule,
    MatInputModule,
    MatTableModule,
    MatDialogModule,
    MatSnackBarModule,
    MatIconModule,
    NgxChartsModule,
  ],
  exports: [
    MatButtonModule,
    MatInputModule,
    MatTableModule,
  ],
})
export class SharedModule {}`;
    const d = sharedModuleBloatRule.analyze(makeFile(content), emptyIndex);
    assert.ok(d.some(x => x.message.includes('third-party')), 'Should flag third-party re-exports');
  });
});
