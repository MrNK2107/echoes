import {
  fakeArRenderer,
  fakeHeading,
  fakeAudioPlayer,
  fakeAudioRecorder,
  fakeConnectivity,
  fakeFiles,
  memoryKeyValue,
} from './fakes';

describe('fakeConnectivity', () => {
  it('reports and notifies changes, and unsubscribes', async () => {
    const c = fakeConnectivity();
    await expect(c.isOnline()).resolves.toBe(true);
    const seen: boolean[] = [];
    const off = c.subscribe((o) => seen.push(o));
    c.setOnline(false);
    await expect(c.isOnline()).resolves.toBe(false);
    off();
    c.setOnline(true);
    expect(seen).toEqual([false]);
  });

  it('can start offline', async () => {
    await expect(fakeConnectivity(false).isOnline()).resolves.toBe(false);
  });
});

describe('memoryKeyValue', () => {
  it('gets, sets and removes', async () => {
    const kv = memoryKeyValue();
    await expect(kv.get('a')).resolves.toBeNull();
    await kv.set('a', '1');
    await expect(kv.get('a')).resolves.toBe('1');
    await kv.remove('a');
    await expect(kv.get('a')).resolves.toBeNull();
  });
});

describe('fakeFiles', () => {
  it('persists to a deterministic uri and removes', async () => {
    const f = fakeFiles();
    await expect(f.persist('file:///tmp/x.m4a', 'x.m4a')).resolves.toBe('persisted://x.m4a');
    await expect(f.remove('persisted://x.m4a')).resolves.toBeUndefined();
  });
});

describe('fakeAudioRecorder', () => {
  it('defaults to granted and a null result', async () => {
    const r = fakeAudioRecorder();
    await expect(r.requestPermission()).resolves.toBe('granted');
    await r.start();
    await expect(r.stop()).resolves.toBeNull();
  });

  it('uses configured permission and result', async () => {
    const result = { uri: 'file:///a.m4a', durationMs: 1200 };
    const r = fakeAudioRecorder({ permission: 'denied', result });
    await expect(r.requestPermission()).resolves.toBe('denied');
    await expect(r.stop()).resolves.toEqual(result);
  });
});

describe('fakeAudioPlayer', () => {
  it('records calls and emits status', () => {
    const p = fakeAudioPlayer();
    const handle = p.load('https://x/a.m4a');
    const seen: unknown[] = [];
    const off = handle.onStatus((s) => seen.push(s));
    handle.play();
    handle.pause();
    off();
    handle.release();
    expect(p.calls).toEqual(['load:https://x/a.m4a', 'play', 'pause', 'release']);
    expect(seen).toEqual([
      { playing: true, error: false, finished: false },
      { playing: false, error: false, finished: false },
    ]);
  });
});

describe('fakeHeading / fakeArRenderer', () => {
  it('fakeHeading emits values and unsubscribes; unavailable rejects', async () => {
    const seen: number[] = [];
    const off = await fakeHeading([10, 20]).subscribe((d: number) => seen.push(d));
    expect(seen).toEqual([10, 20]);
    expect(typeof off).toBe('function');
    await expect(fakeHeading('unavailable').subscribe(() => {})).rejects.toBeDefined();
  });

  it('fakeArRenderer reports the given status', async () => {
    const r = fakeArRenderer('unsupported');
    await expect(r.status()).resolves.toBe('unsupported');
    await expect(r.requestCamera()).resolves.toBe('granted');
    expect(r.Scene).toBeNull();
  });
});
