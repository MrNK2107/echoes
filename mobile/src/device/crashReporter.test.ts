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

const base = { dsn: 'https://k@o0.ingest.sentry.io/1', appOwnership: null, environment: 'firebase' as const, release: '1.0.0' };

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
  });

  it('is a noop in Expo Go (appOwnership or the shared guard)', () => {
    createCrashReporter({ ...base, appOwnership: 'expo' }).init();
    mockIsExpoGo.mockReturnValue(true);
    const r = createCrashReporter(base);
    r.init();
    r.captureException(new Error('x'));
    expect(mockLoaded).not.toHaveBeenCalled();
  });

  it('initialises Sentry without PII and with the environment and release', () => {
    createCrashReporter(base).init();
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: base.dsn,
        sendDefaultPii: false,
        tracesSampleRate: 0.1,
        environment: 'firebase',
        release: '1.0.0',
        beforeSend: expect.any(Function),
        beforeBreadcrumb: expect.any(Function),
      }),
    );
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
});
