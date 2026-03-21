import * as assert from 'assert';
import { extractDependencyGraph } from '../../src/graph/dependency-extractor';
import { AngularFile, ProjectIndex } from '../../src/scanner/project-model';

function makeFile(name: string, content: string, artifactType: string, relativePath?: string): AngularFile {
  return {
    relativePath: relativePath ?? `src/app/${name.toLowerCase()}.ts`,
    uri: `file:///src/app/${name.toLowerCase()}.ts`,
    extension: '.ts',
    sizeBytes: content.length,
    lineCount: content.split('\n').length,
    artifactType: artifactType as AngularFile['artifactType'],
    linkedTemplatePath: null,
    imports: { raw: [], resolved: [] },
    content,
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
      routeCount: 0, htmlCount: 0, styleCount: 0, pipeCount: 0, directiveCount: 0, moduleCount: 0,
    },
    scannedAt: Date.now(),
  };
}

suite('DependencyExtractor', () => {
  test('should extract service -> service edges', () => {
    const a = makeFile('auth', `
@Injectable()
export class AuthService {
  constructor(private httpService: HttpService) {}
}`, 'service', 'src/app/auth.service.ts');

    const b = makeFile('http', `
@Injectable()
export class HttpService {
  constructor() {}
}`, 'service', 'src/app/http.service.ts');

    const graph = extractDependencyGraph(makeIndex([a, b]));

    assert.strictEqual(graph.nodes.length, 2);
    assert.strictEqual(graph.edges.length, 1);
    assert.strictEqual(graph.edges[0].source, 'AuthService');
    assert.strictEqual(graph.edges[0].target, 'HttpService');
    assert.strictEqual(graph.edges[0].isCircular, false);
  });

  test('should extract component -> service edges', () => {
    const comp = makeFile('dashboard', `
@Component({ selector: 'app-dashboard', template: '' })
export class DashboardComponent {
  constructor(private dataService: DataService) {}
}`, 'component', 'src/app/dashboard.component.ts');

    const svc = makeFile('data', `
@Injectable()
export class DataService {}
`, 'service', 'src/app/data.service.ts');

    const graph = extractDependencyGraph(makeIndex([comp, svc]));

    assert.strictEqual(graph.nodes.length, 2);
    assert.strictEqual(graph.edges.length, 1);
    assert.strictEqual(graph.edges[0].source, 'DashboardComponent');
    assert.strictEqual(graph.edges[0].target, 'DataService');
  });

  test('should handle inject() pattern', () => {
    const a = makeFile('user', `
@Injectable()
export class UserService {
  private auth = inject(AuthService);
}`, 'service', 'src/app/user.service.ts');

    const b = makeFile('auth', `
@Injectable()
export class AuthService {}
`, 'service', 'src/app/auth.service.ts');

    const graph = extractDependencyGraph(makeIndex([a, b]));

    assert.strictEqual(graph.edges.length, 1);
    assert.strictEqual(graph.edges[0].source, 'UserService');
    assert.strictEqual(graph.edges[0].target, 'AuthService');
  });

  test('should detect and mark circular dependencies', () => {
    const a = makeFile('a', `
@Injectable()
export class AService {
  constructor(private b: BService) {}
}`, 'service', 'src/app/a.service.ts');

    const b = makeFile('b', `
@Injectable()
export class BService {
  constructor(private a: AService) {}
}`, 'service', 'src/app/b.service.ts');

    const graph = extractDependencyGraph(makeIndex([a, b]));

    assert.strictEqual(graph.circularChains.length, 1);
    assert.ok(graph.edges.some(e => e.isCircular), 'Should have circular edges');
    assert.ok(graph.edges.every(e => e.isCircular), 'Both edges in A<->B should be circular');
  });

  test('should return empty graph for projects with no injectables', () => {
    const template = makeFile('app', '<div>hello</div>', 'template', 'src/app/app.component.html');
    template.extension = '.html';

    const graph = extractDependencyGraph(makeIndex([template]));

    assert.strictEqual(graph.nodes.length, 0);
    assert.strictEqual(graph.edges.length, 0);
  });

  test('should not create self-referencing edges', () => {
    const svc = makeFile('self', `
@Injectable()
export class SelfService {
  constructor(private self: SelfService) {}
}`, 'service', 'src/app/self.service.ts');

    const graph = extractDependencyGraph(makeIndex([svc]));

    assert.strictEqual(graph.nodes.length, 1);
    assert.strictEqual(graph.edges.length, 0, 'Should not create self-edge');
  });

  test('should skip edges to unknown classes', () => {
    const svc = makeFile('my', `
@Injectable()
export class MyService {
  constructor(private ext: ExternalLibService) {}
}`, 'service', 'src/app/my.service.ts');

    const graph = extractDependencyGraph(makeIndex([svc]));

    assert.strictEqual(graph.nodes.length, 1);
    assert.strictEqual(graph.edges.length, 0, 'Should skip edge to unknown target');
  });

  test('should handle complex graph with multiple dependencies', () => {
    const auth = makeFile('auth', `
export class AuthService {
  constructor(private http: HttpService, private config: ConfigService) {}
}`, 'service', 'src/app/auth.service.ts');

    const http = makeFile('http', `
export class HttpService {
  constructor(private config: ConfigService) {}
}`, 'service', 'src/app/http.service.ts');

    const config = makeFile('config', `
export class ConfigService {}
`, 'service', 'src/app/config.service.ts');

    const comp = makeFile('login', `
export class LoginComponent {
  constructor(private auth: AuthService) {}
}`, 'component', 'src/app/login.component.ts');

    const graph = extractDependencyGraph(makeIndex([auth, http, config, comp]));

    assert.strictEqual(graph.nodes.length, 4);
    // AuthService -> HttpService, AuthService -> ConfigService, HttpService -> ConfigService, LoginComponent -> AuthService
    assert.strictEqual(graph.edges.length, 4);
    assert.strictEqual(graph.circularChains.length, 0);
  });

  test('should set correct node types', () => {
    const comp = makeFile('app', `export class AppComponent {}`, 'component');
    const svc = makeFile('data', `export class DataService {}`, 'service');
    const dir = makeFile('highlight', `export class HighlightDirective {}`, 'directive');
    const pipe = makeFile('date', `export class DatePipe {}`, 'pipe');
    const mod = makeFile('shared', `export class SharedModule {}`, 'module');

    const graph = extractDependencyGraph(makeIndex([comp, svc, dir, pipe, mod]));

    assert.strictEqual(graph.nodes.length, 5);
    const types = new Map(graph.nodes.map(n => [n.label, n.type]));
    assert.strictEqual(types.get('AppComponent'), 'component');
    assert.strictEqual(types.get('DataService'), 'service');
    assert.strictEqual(types.get('HighlightDirective'), 'directive');
    assert.strictEqual(types.get('DatePipe'), 'pipe');
    assert.strictEqual(types.get('SharedModule'), 'module');
  });
});
