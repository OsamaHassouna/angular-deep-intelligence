import * as assert from 'assert';
import { oversizedComponentRule } from '../../../src/analyzers/rules/oversized-component';
import { AngularFile, ProjectIndex } from '../../../src/scanner/project-model';

function makeFile(content: string, overrides: Partial<AngularFile> = {}): AngularFile {
  const lines = content.split('\n');
  return {
    relativePath: 'src/app/test.component.ts',
    uri: 'file:///src/app/test.component.ts',
    extension: '.ts',
    sizeBytes: content.length,
    lineCount: lines.length,
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
      componentCount: 0,
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

function generateLargeComponent(lineCount: number): string {
  const lines = [
    "import { Component } from '@angular/core';",
    "@Component({ selector: 'app-big', template: '' })",
    "export class BigComponent {",
  ];

  for (let i = 0; i < lineCount - 4; i++) {
    lines.push(`  property${i} = ${i};`);
  }
  lines.push('}');
  return lines.join('\n');
}

suite('Rule: oversized-component', () => {
  test('should flag component over 300 lines', () => {
    const content = generateLargeComponent(350);
    const file = makeFile(content);
    const diagnostics = oversizedComponentRule.analyze(file, makeIndex([file]));
    assert.ok(diagnostics.length > 0, 'Should flag oversized component');
    assert.strictEqual(diagnostics[0].ruleId, 'oversized-component');
    assert.ok(diagnostics[0].message.includes('350'), 'Message should include line count');
  });

  test('should NOT flag component under 300 lines', () => {
    const content = generateLargeComponent(100);
    const file = makeFile(content);
    const diagnostics = oversizedComponentRule.analyze(file, makeIndex([file]));
    assert.strictEqual(diagnostics.length, 0, 'Should not flag small component');
  });

  test('should skip non-component files', () => {
    const content = generateLargeComponent(400);
    const file = makeFile(content, { artifactType: 'service' });
    const diagnostics = oversizedComponentRule.analyze(file, makeIndex([file]));
    assert.strictEqual(diagnostics.length, 0, 'Should skip services');
  });

  test('should include split suggestions for large methods', () => {
    const lines = [
      "import { Component } from '@angular/core';",
      "@Component({ selector: 'app-big', template: '' })",
      "export class BigComponent {",
      "  processData() {",
    ];
    // Add 40 lines to the method
    for (let i = 0; i < 40; i++) {
      lines.push(`    const val${i} = ${i} * 2;`);
    }
    lines.push("  }");
    // Pad to over 300
    for (let i = 0; i < 260; i++) {
      lines.push(`  field${i} = ${i};`);
    }
    lines.push('}');

    const content = lines.join('\n');
    const file = makeFile(content);
    const diagnostics = oversizedComponentRule.analyze(file, makeIndex([file]));
    assert.ok(diagnostics.length > 0);
    assert.ok(diagnostics[0].suggestion?.includes('processData'), 'Should mention large method name');
  });

  test('should mention excessive constructor dependencies', () => {
    const lines = [
      "import { Component } from '@angular/core';",
      "@Component({ selector: 'app-big', template: '' })",
      "export class BigComponent {",
      "  constructor(",
      "    private a: ServiceA,",
      "    private b: ServiceB,",
      "    private c: ServiceC,",
      "    private d: ServiceD,",
      "    private e: ServiceE,",
      "    private f: ServiceF,",
      "    private g: ServiceG,",
      "    private h: ServiceH,",
      "  ) {}",
    ];
    for (let i = 0; i < 290; i++) {
      lines.push(`  field${i} = ${i};`);
    }
    lines.push('}');

    const content = lines.join('\n');
    const file = makeFile(content);
    const diagnostics = oversizedComponentRule.analyze(file, makeIndex([file]));
    assert.ok(diagnostics.length > 0);
    assert.ok(diagnostics[0].suggestion?.includes('dependencies'), 'Should mention too many dependencies');
  });
});
