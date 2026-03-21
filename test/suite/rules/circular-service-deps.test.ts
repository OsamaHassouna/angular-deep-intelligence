import * as assert from 'assert';
import { circularServiceDepsRule } from '../../../src/analyzers/rules/circular-service-deps';
import { AngularFile, ProjectIndex } from '../../../src/scanner/project-model';

function makeService(name: string, content: string, relativePath?: string): AngularFile {
  return {
    relativePath: relativePath ?? `src/app/${name.toLowerCase()}.service.ts`,
    uri: `file:///src/app/${name.toLowerCase()}.service.ts`,
    extension: '.ts',
    sizeBytes: content.length,
    lineCount: content.split('\n').length,
    artifactType: 'service',
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
      fileCount: files.length, componentCount: 0, serviceCount: files.length,
      routeCount: 0, htmlCount: 0, styleCount: 0, pipeCount: 0, directiveCount: 0, moduleCount: 0,
    },
    scannedAt: Date.now(),
  };
}

suite('Rule: circular-service-deps', () => {
  test('should detect A -> B -> A cycle', () => {
    const a = makeService('a', `
@Injectable()
export class AService {
  constructor(private bService: BService) {}
}`);
    const b = makeService('b', `
@Injectable()
export class BService {
  constructor(private aService: AService) {}
}`);
    const index = makeIndex([a, b]);
    const d = circularServiceDepsRule.analyze(a, index);
    assert.ok(d.length > 0, 'Should detect cycle');
    assert.ok(d[0].message.includes('AService'), 'Should mention AService in cycle');
    assert.ok(d[0].message.includes('BService'), 'Should mention BService in cycle');
  });

  test('should detect A -> B -> C -> A cycle', () => {
    const a = makeService('a', `
@Injectable()
export class AService {
  constructor(private bService: BService) {}
}`, 'src/app/a.service.ts');
    const b = makeService('b', `
@Injectable()
export class BService {
  constructor(private cService: CService) {}
}`, 'src/app/b.service.ts');
    const c = makeService('c', `
@Injectable()
export class CService {
  constructor(private aService: AService) {}
}`, 'src/app/c.service.ts');
    const index = makeIndex([a, b, c]);
    const d = circularServiceDepsRule.analyze(a, index);
    assert.ok(d.length > 0, 'Should detect 3-node cycle');
  });

  test('should not flag linear dependencies', () => {
    const a = makeService('a', `
@Injectable()
export class AService {
  constructor(private bService: BService) {}
}`);
    const b = makeService('b', `
@Injectable()
export class BService {
  constructor(private cService: CService) {}
}`);
    const c = makeService('c', `
@Injectable()
export class CService {
  constructor() {}
}`);
    const index = makeIndex([a, b, c]);
    const d = circularServiceDepsRule.analyze(a, index);
    assert.strictEqual(d.length, 0, 'Should not flag linear chain');
  });

  test('should detect inject() pattern', () => {
    const a = makeService('a', `
@Injectable()
export class AService {
  private bService = inject(BService);
}`);
    const b = makeService('b', `
@Injectable()
export class BService {
  private aService = inject(AService);
}`);
    const index = makeIndex([a, b]);
    const d = circularServiceDepsRule.analyze(a, index);
    assert.ok(d.length > 0, 'Should detect inject() cycle');
  });

  test('should skip non-service files', () => {
    const comp = makeService('test', `
@Component({ selector: 'test', template: '' })
export class TestComponent {
  constructor(private aService: AService) {}
}`);
    comp.artifactType = 'component';
    const index = makeIndex([comp]);
    const d = circularServiceDepsRule.analyze(comp, index);
    assert.strictEqual(d.length, 0, 'Should skip components');
  });

  test('should only run once (from first service)', () => {
    const a = makeService('a', `
@Injectable()
export class AService {
  constructor(private bService: BService) {}
}`, 'src/app/a.service.ts');
    const b = makeService('b', `
@Injectable()
export class BService {
  constructor(private aService: AService) {}
}`, 'src/app/b.service.ts');
    const index = makeIndex([a, b]);

    // Running from second service should return nothing (avoids duplicates)
    const d = circularServiceDepsRule.analyze(b, index);
    assert.strictEqual(d.length, 0, 'Should only run from first service in index');
  });
});
