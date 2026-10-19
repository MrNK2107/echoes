import fs from 'fs';
import os from 'os';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { checkBundleSize } = require('../scripts/check-bundle-size.js') as {
  checkBundleSize(dirs: string[], maxBytes?: number): { ok: boolean; sizes: Record<string, number> };
};

let root: string;
function makeDist(name: string, bytes: number, platform = 'android'): string {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, '_expo'), { recursive: true });
  fs.writeFileSync(path.join(dir, '_expo', 'entry.hbc'), Buffer.alloc(bytes));
  const meta = { fileMetadata: { [platform]: { bundle: '_expo/entry.hbc', assets: [] } } };
  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(meta));
  return dir;
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('checkBundleSize', () => {
  it('passes when every bundle is under the limit and reports sizes per platform', () => {
    const a = makeDist('dist', 100);
    const i = makeDist('dist-ios', 200, 'ios');
    expect(checkBundleSize([a, i], 1000)).toEqual({ ok: true, sizes: { [`${a}:android`]: 100, [`${i}:ios`]: 200 } });
  });

  it('passes at exactly the limit and defaults to 7864320 bytes', () => {
    const a = makeDist('dist', 1000);
    expect(checkBundleSize([a], 1000).ok).toBe(true);
    expect(checkBundleSize([makeDist('d2', 7864320)]).ok).toBe(true);
    expect(checkBundleSize([makeDist('d3', 7864321)]).ok).toBe(false);
  });

  it('fails when any bundle is over the limit', () => {
    const a = makeDist('dist', 100);
    const i = makeDist('dist-ios', 2000, 'ios');
    const r = checkBundleSize([a, i], 1000);
    expect(r.ok).toBe(false);
    expect(r.sizes).toEqual({ [`${a}:android`]: 100, [`${i}:ios`]: 2000 });
  });

  it('fails on a missing metadata file', () => {
    const a = makeDist('dist', 100);
    const missing = path.join(root, 'dist-ios');
    expect(checkBundleSize([a, missing], 1000).ok).toBe(false);
  });

  it('fails when the bundle file named in metadata is missing', () => {
    const a = makeDist('dist', 100);
    fs.rmSync(path.join(a, '_expo', 'entry.hbc'));
    expect(checkBundleSize([a], 1000).ok).toBe(false);
  });
});
