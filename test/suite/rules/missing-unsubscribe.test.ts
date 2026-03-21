import * as assert from 'assert';
import { missingUnsubscribeRule } from '../../../src/analyzers/rules/missing-unsubscribe';
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

suite('Rule: missing-unsubscribe', () => {
  test('should detect .subscribe() without cleanup', () => {
    const content = `
import { Component, OnInit } from '@angular/core';
@Component({ selector: 'app-test', template: '' })
export class TestComponent implements OnInit {
  ngOnInit() {
    this.someObservable$.subscribe(data => {
      this.data = data;
    });
  }
}`;
    const file = makeFile(content);
    const diagnostics = missingUnsubscribeRule.analyze(file, makeIndex([file]));
    assert.ok(diagnostics.length > 0, 'Should detect subscribe without cleanup');
    assert.strictEqual(diagnostics[0].ruleId, 'missing-unsubscribe');
  });

  test('should NOT flag when takeUntilDestroyed is used', () => {
    const content = `
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
@Component({ selector: 'app-test', template: '' })
export class TestComponent {
  private destroyRef = inject(DestroyRef);
  ngOnInit() {
    this.data$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(d => this.data = d);
  }
}`;
    const file = makeFile(content);
    const diagnostics = missingUnsubscribeRule.analyze(file, makeIndex([file]));
    assert.strictEqual(diagnostics.length, 0, 'Should not flag takeUntilDestroyed');
  });

  test('should NOT flag when ngOnDestroy + unsubscribe exists', () => {
    const content = `
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
@Component({ selector: 'app-test', template: '' })
export class TestComponent implements OnInit, OnDestroy {
  private sub: Subscription;
  ngOnInit() {
    this.sub = this.data$.subscribe(d => this.data = d);
  }
  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}`;
    const file = makeFile(content);
    const diagnostics = missingUnsubscribeRule.analyze(file, makeIndex([file]));
    assert.strictEqual(diagnostics.length, 0, 'Should not flag with ngOnDestroy + unsubscribe');
  });

  test('should NOT flag when ngOnDestroy + takeUntil exists', () => {
    const content = `
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
@Component({ selector: 'app-test', template: '' })
export class TestComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  ngOnInit() {
    this.data$.pipe(takeUntil(this.destroy$)).subscribe(d => this.data = d);
  }
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}`;
    const file = makeFile(content);
    const diagnostics = missingUnsubscribeRule.analyze(file, makeIndex([file]));
    assert.strictEqual(diagnostics.length, 0, 'Should not flag with takeUntil pattern');
  });

  test('should skip services', () => {
    const content = `
import { Injectable } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class TestService {
  init() {
    this.data$.subscribe(d => this.data = d);
  }
}`;
    const file = makeFile(content, { artifactType: 'service' });
    const diagnostics = missingUnsubscribeRule.analyze(file, makeIndex([file]));
    assert.strictEqual(diagnostics.length, 0, 'Should skip services');
  });

  test('should detect multiple subscribes', () => {
    const content = `
import { Component, OnInit } from '@angular/core';
@Component({ selector: 'app-test', template: '' })
export class TestComponent implements OnInit {
  ngOnInit() {
    this.a$.subscribe(a => this.a = a);
    this.b$.subscribe(b => this.b = b);
    this.c$.subscribe(c => this.c = c);
  }
}`;
    const file = makeFile(content);
    const diagnostics = missingUnsubscribeRule.analyze(file, makeIndex([file]));
    assert.ok(diagnostics.length >= 2, `Should detect multiple subscribes, got ${diagnostics.length}`);
  });

  test('should check linked template for async pipe', () => {
    const templateFile = makeFile('{{ data$ | async }}', {
      relativePath: 'src/app/test.component.html',
      uri: 'file:///src/app/test.component.html',
      extension: '.html',
      artifactType: 'template',
    });
    const content = `
import { Component } from '@angular/core';
@Component({ selector: 'app-test', templateUrl: './test.component.html' })
export class TestComponent {
  ngOnInit() {
    this.data$.subscribe(d => this.data = d);
  }
}`;
    const componentFile = makeFile(content, {
      linkedTemplatePath: 'src/app/test.component.html',
    });
    const index = makeIndex([componentFile, templateFile]);
    const diagnostics = missingUnsubscribeRule.analyze(componentFile, index);
    assert.strictEqual(diagnostics.length, 0, 'Should not flag when template uses async pipe');
  });
});
