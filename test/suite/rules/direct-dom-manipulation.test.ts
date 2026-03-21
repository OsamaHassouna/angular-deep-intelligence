import * as assert from 'assert';
import { directDomManipulationRule } from '../../../src/analyzers/rules/direct-dom-manipulation';
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

const emptyIndex: ProjectIndex = {
  rootPath: '/project', files: [], fileMap: new Map(),
  stats: { fileCount: 0, componentCount: 0, serviceCount: 0, routeCount: 0, htmlCount: 0, styleCount: 0, pipeCount: 0, directiveCount: 0, moduleCount: 0 },
  scannedAt: Date.now(),
};

suite('Rule: direct-dom-manipulation', () => {
  test('should detect nativeElement usage', () => {
    const content = `
@Component({ selector: 'app-test', template: '' })
export class TestComponent {
  constructor(private el: ElementRef) {}
  ngAfterViewInit() {
    this.el.nativeElement.style.color = 'red';
  }
}`;
    const d = directDomManipulationRule.analyze(makeFile(content), emptyIndex);
    assert.ok(d.length > 0, 'Should detect nativeElement');
    assert.ok(d[0].message.includes('nativeElement'));
  });

  test('should detect document.querySelector', () => {
    const content = `
@Component({ selector: 'app-test', template: '' })
export class TestComponent {
  ngOnInit() {
    const el = document.querySelector('.my-class');
  }
}`;
    const d = directDomManipulationRule.analyze(makeFile(content), emptyIndex);
    assert.ok(d.length > 0, 'Should detect querySelector');
  });

  test('should detect innerHTML assignment', () => {
    const content = `
@Component({ selector: 'app-test', template: '' })
export class TestComponent {
  ngOnInit() {
    this.container.innerHTML = '<p>hello</p>';
  }
}`;
    const d = directDomManipulationRule.analyze(makeFile(content), emptyIndex);
    assert.ok(d.length > 0, 'Should detect innerHTML');
  });

  test('should skip services', () => {
    const content = `
@Injectable()
export class DomService {
  setStyle() { document.querySelector('.x'); }
}`;
    const d = directDomManipulationRule.analyze(makeFile(content, { artifactType: 'service' }), emptyIndex);
    assert.strictEqual(d.length, 0, 'Should skip services');
  });

  test('should skip comments', () => {
    const content = `
@Component({ selector: 'app-test', template: '' })
export class TestComponent {
  // this.el.nativeElement used to be here
  /* document.querySelector is not used */
}`;
    const d = directDomManipulationRule.analyze(makeFile(content), emptyIndex);
    assert.strictEqual(d.length, 0, 'Should skip comments');
  });
});
