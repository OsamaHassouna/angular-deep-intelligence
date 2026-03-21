import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Mocha = require('mocha');
import * as fs from 'fs';

export function run(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mocha = new (Mocha as any)({
    ui: 'tdd',
    color: true,
    timeout: 30000,
  });

  const testsRoot = path.resolve(__dirname);

  return new Promise((resolve, reject) => {
    const testFiles = findTestFiles(testsRoot);
    testFiles.forEach(f => mocha.addFile(f));

    try {
      mocha.run((failures: number) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

function findTestFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(fullPath));
    } else if (entry.name.endsWith('.test.js')) {
      results.push(fullPath);
    }
  }
  return results;
}
