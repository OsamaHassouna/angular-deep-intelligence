import * as assert from 'assert';
import { lazyLoadingOpportunitiesRule } from '../../../src/analyzers/rules/lazy-loading-opportunities';
import { AngularFile, ProjectIndex } from '../../../src/scanner/project-model';

function makeFile(content: string, overrides: Partial<AngularFile> = {}): AngularFile {
  return {
    relativePath: 'src/app/app-routing.module.ts',
    uri: 'file:///src/app/app-routing.module.ts',
    extension: '.ts',
    sizeBytes: content.length,
    lineCount: content.split('\n').length,
    artifactType: 'source',
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
    rootPath: '/project',
    files,
    fileMap,
    stats: {
      fileCount: files.length, componentCount: 0, serviceCount: 0,
      routeCount: 0, htmlCount: 0, styleCount: 0, pipeCount: 0, directiveCount: 0,
      moduleCount: files.filter(f => f.artifactType === 'module').length,
    },
    scannedAt: Date.now(),
  };
}

suite('Rule: lazy-loading-opportunities', () => {
  test('should detect eagerly loaded route component', () => {
    const content = `
const routes: Routes = [
  { path: 'dashboard', component: DashboardComponent },
  { path: 'settings', component: SettingsComponent },
];`;
    const file = makeFile(content);
    const d = lazyLoadingOpportunitiesRule.analyze(file, makeIndex([file]));
    assert.ok(d.length >= 1, 'Should detect eager routes');
    assert.ok(d[0].message.includes('eagerly'), 'Message should mention eager loading');
  });

  test('should not flag lazy-loaded routes', () => {
    const content = `
const routes: Routes = [
  { path: 'dashboard', loadComponent: () => import('./dashboard').then(m => m.DashboardComponent) },
  { path: 'admin', loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule) },
];`;
    const file = makeFile(content);
    const d = lazyLoadingOpportunitiesRule.analyze(file, makeIndex([file]));
    assert.strictEqual(d.length, 0, 'Should not flag lazy routes');
  });

  test('should not flag redirect routes', () => {
    const content = `
const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];`;
    const file = makeFile(content);
    const d = lazyLoadingOpportunitiesRule.analyze(file, makeIndex([file]));
    assert.strictEqual(d.length, 0, 'Should not flag redirects');
  });

  test('should detect eagerly imported feature module in AppModule', () => {
    const appModule = makeFile(`
@NgModule({
  imports: [
    BrowserModule,
    CommonModule,
    OrdersModule,
    SettingsModule,
  ],
})
export class AppModule {}`, {
      relativePath: 'src/app/app.module.ts',
      artifactType: 'module',
    });

    const ordersModule = makeFile(`
@NgModule({ declarations: [OrdersListComponent] })
export class OrdersModule {}`, {
      relativePath: 'src/app/features/orders/orders.module.ts',
      artifactType: 'module',
    });

    const index = makeIndex([appModule, ordersModule]);
    const d = lazyLoadingOpportunitiesRule.analyze(appModule, index);
    assert.ok(d.some(x => x.message.includes('OrdersModule')), 'Should flag eagerly imported OrdersModule');
  });

  test('should not flag Angular built-in modules', () => {
    const appModule = makeFile(`
@NgModule({
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    HttpClientModule,
    RouterModule,
  ],
})
export class AppModule {}`, {
      relativePath: 'src/app/app.module.ts',
      artifactType: 'module',
    });

    const index = makeIndex([appModule]);
    const d = lazyLoadingOpportunitiesRule.analyze(appModule, index);
    assert.strictEqual(d.length, 0, 'Should not flag built-in modules');
  });

  test('should skip non-routing non-module files', () => {
    const content = `
@Component({ selector: 'test', template: '' })
export class TestComponent {}`;
    const file = makeFile(content, {
      relativePath: 'src/app/test.component.ts',
      artifactType: 'component',
    });
    const d = lazyLoadingOpportunitiesRule.analyze(file, makeIndex([file]));
    assert.strictEqual(d.length, 0, 'Should skip regular components');
  });
});
