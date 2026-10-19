import fs from 'fs';
import path from 'path';

import { parse } from 'yaml';

const CI = path.resolve(__dirname, '..', '..', '.github', 'workflows', 'ci.yml');

type Step = { name?: string; run?: string; uses?: string };
type Workflow = { jobs: Record<string, { steps: Step[] }> };

function runs(job: string): string {
  const wf = parse(fs.readFileSync(CI, 'utf8')) as Workflow;
  return wf.jobs[job].steps.map((s) => s.run ?? '').join('\n');
}

describe('ci.yml', () => {
  it('has backend and mobile jobs and no Flutter', () => {
    const text = fs.readFileSync(CI, 'utf8');
    const wf = parse(text) as Workflow;
    expect(Object.keys(wf.jobs).sort()).toEqual(['backend', 'mobile']);
    expect(text).not.toMatch(/flutter/i);
  });

  it('backend runs functions, rules, rules-sync and the emulator contract', () => {
    const r = runs('backend');
    expect(r).toContain('node scripts/build-rules.js');
    expect(r).toContain('git diff --exit-code firestore.rules firestore.lan.rules');
    expect(r).toContain('npm test');
    expect(r).toContain('--only firestore,storage');
    expect(r).toContain('--only auth,firestore,storage,functions');
    expect(r).toContain('test:emulator');
  });

  it('mobile exports both platforms before the bundle check', () => {
    const r = runs('mobile');
    const android = r.indexOf('--platform android --output-dir dist');
    const ios = r.indexOf('--platform ios --output-dir dist-ios');
    const check = r.indexOf('check:bundle');
    expect(android).toBeGreaterThanOrEqual(0);
    expect(ios).toBeGreaterThan(android);
    expect(check).toBeGreaterThan(ios);
    expect(r).toContain('npm test');
    expect(r).toContain('npm run typecheck');
    expect(r).toContain('npm run lint');
  });
});
