describe('expoArRenderer', () => {
  afterEach(() => jest.resetModules());

  it("reports 'missing' when the viro require throws", async () => {
    jest.doMock('@reactvision/react-viro', () => {
      throw new Error('Cannot find module');
    }, { virtual: true });
    const { expoArRenderer } = require('./arRenderer');
    await expect(expoArRenderer.status()).resolves.toBe('missing');
    expect(expoArRenderer.Scene).toBeNull();
  });

  it("reports 'available' / 'unsupported' via ViroUtils when present", async () => {
    jest.doMock('@reactvision/react-viro', () => ({ ViroUtils: { isARSupportedOnDevice: (cb: (s: boolean) => void) => cb(true) } }), { virtual: true });
    expect(await require('./arRenderer').expoArRenderer.status()).toBe('available');
    jest.resetModules();
    jest.doMock('@reactvision/react-viro', () => ({ ViroUtils: { isARSupportedOnDevice: (cb: (s: boolean) => void) => cb(false) } }), { virtual: true });
    expect(await require('./arRenderer').expoArRenderer.status()).toBe('unsupported');
  });
});
