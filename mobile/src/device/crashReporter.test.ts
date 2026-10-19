import { createCrashReporter, scrub } from './crashReporter';

const mockLoaded = jest.fn();
const mockInit = jest.fn();
const mockCapture = jest.fn();

jest.mock('@sentry/react-native', () => {
  mockLoaded();
  return { init: mockInit, captureException: mockCapture };
});

const mockIsExpoGo = jest.fn(() => false);
jest.mock('./expoGo', () => ({ isExpoGo: () => mockIsExpoGo() }));

const base = { dsn: 'https://k@o0.ingest.sentry.io/1', appOwnership: null, environment: 'firebase' as const };

beforeEach(() => {
  jest.clearAllMocks();
  mockIsExpoGo.mockReturnValue(false);
});

describe('createCrashReporter', () => {
  it('is a noop without a DSN and never requires Sentry', () => {
    const r = createCrashReporter({ ...base, dsn: null });
    r.init();
    r.captureException(new Error('x'));
    expect(mockLoaded).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('is a noop in Expo Go (appOwnership or the shared guard)', () => {
    createCrashReporter({ ...base, appOwnership: 'expo' }).init();
    mockIsExpoGo.mockReturnValue(true);
    const r = createCrashReporter(base);
    r.init();
    r.captureException(new Error('x'));
    expect(mockLoaded).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('initialises Sentry without PII and with the environment and release', () => {
    createCrashReporter(base).init();
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: base.dsn,
        sendDefaultPii: false,
        tracesSampleRate: 0.1,
        environment: 'firebase',
        beforeSend: expect.any(Function),
        beforeBreadcrumb: expect.any(Function),
      }),
    );
    // The SDK defaults release/dist to what the Sentry Expo plugin uploads (bundleId@version+build).
    expect(mockInit.mock.calls[0][0]).not.toHaveProperty('release');
    expect(mockInit.mock.calls[0][0]).not.toHaveProperty('dist');
  });

  it('scrubs breadcrumb URLs and events through the hooks', () => {
    createCrashReporter(base).init();
    const opts = mockInit.mock.calls[0][0];
    expect(opts.beforeBreadcrumb({ data: { url: 'https://api.x/y?token=abc&a=1' } }).data.url).toBe('https://api.x/y');
    expect(opts.beforeSend({ message: 'mail a@b.co' }).message).toBe('mail [email]');
  });

  it('captures through Sentry once initialised, with context as tags', () => {
    const r = createCrashReporter(base);
    r.init();
    const e = new Error('boom');
    r.captureException(e, { screen: 'map' });
    expect(mockCapture).toHaveBeenCalledWith(e, { tags: { screen: 'map' } });
  });

  it('never throws when Sentry fails', () => {
    mockInit.mockImplementationOnce(() => {
      throw new Error('native');
    });
    const r = createCrashReporter(base);
    expect(() => r.init()).not.toThrow();
    expect(() => r.captureException(new Error('x'))).not.toThrow();
  });
});

describe('scrub', () => {
  it('replaces uids in Storage and Firestore paths', () => {
    const out = scrub({
      a: 'https://x/o/memory-images/uidABC123/p.jpg',
      b: 'memory-audio/uidABC123/v.m4a failed',
      c: 'permission denied at /databases/(default)/documents/users/uidABC123/blocks/other',
      d: 'publicProfiles/uidABC123',
    });
    expect(out).toEqual({
      a: 'https://x/o/memory-images/[uid]/p.jpg',
      b: 'memory-audio/[uid]/v.m4a failed',
      c: 'permission denied at /databases/(default)/documents/users/[uid]/blocks/other',
      d: 'publicProfiles/[uid]',
    });
  });


  it('removes push tokens, emails and query strings, deeply', () => {
    const out = scrub({
      message: 'failed for ExponentPushToken[abc-123] and ExpoPushToken[zzz]',
      user: { email: 'jane.doe+x@example.com' },
      request: { url: 'https://h.io/p?key=SECRET&b=2' },
      breadcrumbs: [{ data: { url: 'https://h.io/q?token=T' } }],
      count: 3,
    });
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/abc-123|zzz|jane|example\.com|SECRET|token=|key=/);
    expect(out.request.url).toBe('https://h.io/p');
    expect(out.count).toBe(3);
  });

  it('scrubs a shared reference every time it appears, and bounds depth', () => {
    const shared = { url: 'https://h.io/p?key=S', who: 'a@b.co' };
    const out = scrub({ a: shared, b: shared, list: [shared] });
    expect(JSON.stringify(out)).not.toMatch(/key=|a@b\.co/);
    let deep: Record<string, unknown> = { leaf: 'x@y.zz' };
    for (let i = 0; i < 30; i++) deep = { n: deep };
    expect(JSON.stringify(scrub(deep))).toContain('[depth]');
    expect(JSON.stringify(scrub(deep))).not.toContain('x@y.zz');
  });

  it('strips fragments containing = and bearer tokens', () => {
    const out = scrub({ url: 'https://h.io/cb#access_token=abc&x=1', keep: 'https://h.io/page#top', h: 'Authorization: Bearer abc.def-123' });
    expect(out.url).toBe('https://h.io/cb');
    expect(out.keep).toBe('https://h.io/page#top');
    expect(out.h).toBe('Authorization: [bearer]');
  });
});
