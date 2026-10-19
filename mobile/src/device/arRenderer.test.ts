/* eslint-disable @typescript-eslint/no-require-imports -- jest.doMock needs lazy require */

interface Mocks {
  motionAvailable?: boolean | Error;
  cameraAvailable?: boolean | Error;
  granted?: boolean;
  os?: string;
}

function load({ motionAvailable = true, cameraAvailable = true, granted = true, os = 'android' }: Mocks = {}) {
  jest.resetModules();
  require('react-native').Platform.OS = os;
  const listeners: ((m: unknown) => void)[] = [];
  const remove = jest.fn();
  const setUpdateInterval = jest.fn();
  const settle = (v: boolean | Error) => (v instanceof Error ? Promise.reject(v) : Promise.resolve(v));
  jest.doMock('expo-sensors', () => ({
    DeviceMotion: {
      isAvailableAsync: () => settle(motionAvailable),
      setUpdateInterval,
      addListener: (cb: (m: unknown) => void) => {
        listeners.push(cb);
        return { remove };
      },
    },
  }));
  jest.doMock('expo-camera', () => ({
    CameraView: Object.assign(() => null, { isAvailableAsync: () => settle(cameraAvailable) }),
    Camera: { requestCameraPermissionsAsync: async () => ({ granted }) },
  }));
  jest.doMock('expo-location', () => ({
    getHeadingAsync: async () => ({ trueHeading: 12, magHeading: 10 }),
  }));
  const { expoArRenderer } = require('./arRenderer');
  return { renderer: expoArRenderer, listeners, remove, setUpdateInterval };
}

describe('expoArRenderer (camera AR)', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it("is 'available' with motion sensors and a camera", async () => {
    await expect(load().renderer.status()).resolves.toBe('available');
  });

  it("is 'unsupported' without device motion or when the check throws", async () => {
    await expect(load({ motionAvailable: false }).renderer.status()).resolves.toBe('unsupported');
    await expect(load({ motionAvailable: new Error('x') }).renderer.status()).resolves.toBe('unsupported');
  });

  it("is 'unsupported' when the camera reports unavailable, but tolerates a missing check", async () => {
    await expect(load({ cameraAvailable: false }).renderer.status()).resolves.toBe('unsupported');
    await expect(load({ cameraAvailable: new Error('not implemented') }).renderer.status()).resolves.toBe('available');
  });

  it("is 'unsupported' and has no scene on web", async () => {
    const { renderer } = load({ os: 'web' });
    await expect(renderer.status()).resolves.toBe('unsupported');
    expect(renderer.Scene).toBeNull();
  });

  it('maps the camera permission', async () => {
    await expect(load().renderer.requestCamera()).resolves.toBe('granted');
    await expect(load({ granted: false }).renderer.requestCamera()).resolves.toBe('denied');
  });

  it('provides one memoised scene on native platforms', () => {
    for (const os of ['android', 'ios']) {
      const { renderer } = load({ os });
      expect(renderer.Scene).not.toBeNull();
      expect(renderer.Scene).toBe(renderer.Scene);
    }
  });
});
