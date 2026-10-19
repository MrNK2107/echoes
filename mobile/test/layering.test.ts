import { execFileSync } from 'child_process';
import path from 'path';

const cwd = path.resolve(__dirname, '..');

/**
 * Lints source text with `new ESLint({ cwd }).lintText(code, { filePath })`, which writes no file,
 * so parallel Jest workers and source-scanning tests never see a fixture. It runs in a child
 * process because ESLint loads its flat config with a dynamic import that Jest's VM cannot do.
 */
function restricted(code: string, filePath: string): number {
  const script = `
    const { ESLint } = require('eslint');
    const { code, filePath } = JSON.parse(process.argv[1]);
    new ESLint({ cwd: process.cwd() }).lintText(code, { filePath }).then(([r]) => {
      process.stdout.write(String(r.messages.filter((m) => m.ruleId === 'no-restricted-imports').length));
    });
  `;
  const out = execFileSync(process.execPath, ['-e', script, JSON.stringify({ code, filePath })], { cwd, encoding: 'utf8' });
  return Number(out);
}

const importOf = (layer: string) => `import { x } from '@/${layer}/a';\nexport const y = x;\n`;

describe('layer import rules', () => {
  jest.setTimeout(60_000);

  it('rejects a @/features import from src/device', () => {
    expect(restricted(importOf('features'), 'src/device/__fixture__.ts')).toBe(1);
  });

  it('rejects @/features from src/data', () => {
    expect(restricted(importOf('features'), 'src/data/__fixture__.ts')).toBe(1);
  });

  it('rejects the upper layers from src/domain', () => {
    for (const layer of ['data', 'device', 'services', 'features']) {
      expect(restricted(importOf(layer), 'src/domain/__fixture__.ts')).toBe(1);
    }
  });

  it('allows the permitted directions', () => {
    expect(restricted(importOf('domain'), 'src/device/__fixture__.ts')).toBe(0);
    expect(restricted(importOf('device'), 'src/features/__fixture__.ts')).toBe(0);
    expect(restricted(importOf('data'), 'src/services/__fixture__.ts')).toBe(0);
  });
});
