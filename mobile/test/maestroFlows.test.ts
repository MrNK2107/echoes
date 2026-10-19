import fs from 'fs';
import path from 'path';

import { lintFlow } from './maestroLint';

const ROOT = path.resolve(__dirname, '..');
const FLOW_DIR = path.join(ROOT, '.maestro');
const EXPECTED = [
  'sign-in-and-map.yaml',
  'add-memory.yaml',
  'memory-lifecycle.yaml',
  'report-and-block.yaml',
  'communities.yaml',
  'delete-account.yaml',
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

// Test files are excluded so a flow cannot pass on copy that only a test mentions.
const SOURCE = [...sourceFiles(path.join(ROOT, 'src')), ...sourceFiles(path.join(ROOT, 'app'))]
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n');

describe('Maestro flows (ADR-0012)', () => {
  it('has the six flows and a workspace config', () => {
    for (const f of EXPECTED) expect(fs.existsSync(path.join(FLOW_DIR, f))).toBe(true);
    expect(fs.existsSync(path.join(FLOW_DIR, 'config.yaml'))).toBe(true);
  });

  it.each(EXPECTED)('%s parses and every selector is found in the app copy', (file) => {
    const text = fs.readFileSync(path.join(FLOW_DIR, file), 'utf8');
    expect(lintFlow(text, SOURCE)).toEqual([]);
  });

  it('the app ids the flows may use exist in app.config.ts', () => {
    const cfg = fs.readFileSync(path.join(ROOT, 'app.config.ts'), 'utf8');
    expect(cfg).toContain('com.phantom.echoes');
    expect(cfg).toContain('com.mrnk2107.echoes');
  });

  describe('lintFlow', () => {
    const flow = (cmds: string, appId = '${APP_ID}') => `appId: ${appId}\n---\n${cmds}`;

    it('reports a selector that matches no source string', () => {
      const problems = lintFlow(flow('- tapOn: "Definitely not in the app"\n'), SOURCE);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('Definitely not in the app');
    });

    it('checks assertVisible, assertNotVisible and object selectors too', () => {
      const yaml = flow(
        '- assertVisible: "Bogus one"\n- assertNotVisible:\n    text: "Bogus two"\n- scrollUntilVisible:\n    element:\n      text: "Bogus three"\n',
      );
      expect(lintFlow(yaml, SOURCE)).toHaveLength(3);
    });

    it('accepts real copy, regex tails and templated copy', () => {
      const yaml = flow(
        '- tapOn: "Sign in"\n- assertVisible: "Thanks.*review it."\n- tapOn: "Report Asha Rao"\n- tapOn: "Block Asha Rao"\n',
      );
      expect(lintFlow(yaml, SOURCE)).toEqual([]);
    });

    it('rejects an id selector, a wrong appId and invalid YAML', () => {
      expect(lintFlow(flow('- tapOn:\n    id: "x"\n'), SOURCE)).toHaveLength(1);
      expect(lintFlow(flow('- tapOn: "Sign in"\n', 'com.other.app'), SOURCE)).toHaveLength(1);
      expect(lintFlow('appId: [unclosed', SOURCE).length).toBeGreaterThan(0);
    });

    it('accepts the literal Android id', () => {
      expect(lintFlow(flow('- tapOn: "Sign in"\n', 'com.phantom.echoes'), SOURCE)).toEqual([]);
    });
  });
});
