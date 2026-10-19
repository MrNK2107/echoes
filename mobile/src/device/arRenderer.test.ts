/* eslint-disable @typescript-eslint/no-require-imports -- jest.doMock needs lazy require */
type Check = (notSupported: (reason?: string) => void, supported: () => void) => unknown;

function mockViro(check: Check | undefined) {
  jest.resetModules();
  jest.doMock('@reactvision/react-viro', () => ({ ViroUtils: { isARSupportedOnDevice: check } }), {
    virtual: true,
  });
  return require('./arRenderer').expoArRenderer;
}

describe('expoArRenderer', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
  });

  it("reports 'missing' when the viro require throws", async () => {
    jest.doMock(
      '@reactvision/react-viro',
      () => {
        throw new Error('Cannot find module');
      },
      { virtual: true },
    );
    const { expoArRenderer } = require('./arRenderer');
    await expect(expoArRenderer.status()).resolves.toBe('missing');
    expect(expoArRenderer.Scene).toBeNull();
  });

  it("is 'available' when the supported callback fires", async () => {
    const r = mockViro((_no, yes) => yes());
    await expect(r.status()).resolves.toBe('available');
  });

  it("is 'unsupported' when the not-supported callback fires", async () => {
    const r = mockViro((no) => no('reason'));
    await expect(r.status()).resolves.toBe('unsupported');
  });

  it('handles a returned boolean or promise', async () => {
    await expect(mockViro(() => true).status()).resolves.toBe('available');
    await expect(mockViro(() => Promise.resolve(false)).status()).resolves.toBe('unsupported');
  });

  it("is 'available' when viro has no support check", async () => {
    await expect(mockViro(undefined).status()).resolves.toBe('available');
  });

  it("is 'unsupported' after 3 s when no callback fires", async () => {
    jest.useFakeTimers();
    const r = mockViro(() => undefined);
    const p = r.status();
    await jest.advanceTimersByTimeAsync(3000);
    await expect(p).resolves.toBe('unsupported');
  });

  it("is 'unsupported' when the check throws", async () => {
    const r = mockViro(() => {
      throw new Error('boom');
    });
    await expect(r.status()).resolves.toBe('unsupported');
  });
});
