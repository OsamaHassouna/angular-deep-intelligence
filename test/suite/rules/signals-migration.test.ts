import * as assert from 'assert';
import { signalsMigrationRule } from '../../../src/analyzers/rules/signals-migration';
import { AngularFile, ProjectIndex } from '../../../src/scanner/project-model';

function makeFile(content: string, overrides: Partial<AngularFile> = {}): AngularFile {
  return {
    relativePath: 'src/app/test.service.ts',
    uri: 'file:///src/app/test.service.ts',
    extension: '.ts',
    sizeBytes: content.length,
    lineCount: content.split('\n').length,
    artifactType: 'service',
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

suite('Rule: signals-migration', () => {
  test('should detect BehaviorSubject with .next()', () => {
    const content = `
@Injectable({ providedIn: 'root' })
export class CounterService {
  private count$ = new BehaviorSubject<number>(0);
  increment() { this.count$.next(this.count$.getValue() + 1); }
}`;
    const d = signalsMigrationRule.analyze(makeFile(content), emptyIndex);
    assert.ok(d.some(x => x.message.includes('BehaviorSubject')), 'Should detect BehaviorSubject');
  });

  test('should detect .getValue()', () => {
    const content = `
@Injectable({ providedIn: 'root' })
export class StateService {
  private data$ = new BehaviorSubject<string[]>([]);
  getCurrent() { return this.data$.getValue(); }
}`;
    const d = signalsMigrationRule.analyze(makeFile(content), emptyIndex);
    assert.ok(d.some(x => x.message.includes('getValue')), 'Should detect getValue()');
  });

  test('should detect combineLatest + map pattern', () => {
    const content = `
@Injectable({ providedIn: 'root' })
export class DerivedService {
  combined$ = combineLatest([this.a$, this.b$]).pipe(
    map(([a, b]) => a + b)
  );
}`;
    const d = signalsMigrationRule.analyze(makeFile(content), emptyIndex);
    assert.ok(d.some(x => x.message.includes('combineLatest')), 'Should detect combineLatest+map');
  });

  test('should skip pipe files', () => {
    const content = `
@Pipe({ name: 'test' })
export class TestPipe {
  private state$ = new BehaviorSubject<number>(0);
}`;
    const d = signalsMigrationRule.analyze(makeFile(content, { artifactType: 'pipe' }), emptyIndex);
    assert.strictEqual(d.length, 0, 'Should skip pipes');
  });

  test('should detect private Subject for local state', () => {
    const content = `
@Component({ selector: 'app-test', template: '' })
export class TestComponent {
  private loading = new Subject<boolean>();
  load() { this.loading.next(true); }
}`;
    const d = signalsMigrationRule.analyze(makeFile(content, { artifactType: 'component' }), emptyIndex);
    assert.ok(d.some(x => x.message.includes('loading')), 'Should detect private Subject');
  });
});
