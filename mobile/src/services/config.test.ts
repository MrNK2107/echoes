import { readConfig } from './config';

describe('readConfig', () => {
  it('defaults to the memory backend with no firebase config', () => {
    const c = readConfig({});
    expect(c.backend).toBe('memory');
    expect(c.firebase).toBeNull();
    expect(c.emulatorHost).toBe('127.0.0.1');
  });

  it('uses demo-echoes defaults for the emulator backend', () => {
    const c = readConfig({ EXPO_PUBLIC_BACKEND: 'emulator' });
    expect(c.backend).toBe('emulator');
    expect(c.emulatorHost).toBe('127.0.0.1');
    expect(c.firebase).toEqual({
      apiKey: 'demo-api-key',
      authDomain: 'demo-echoes.firebaseapp.com',
      projectId: 'demo-echoes',
      storageBucket: 'demo-echoes.appspot.com',
      appId: 'demo-app-id',
      messagingSenderId: '0',
    });
  });

  it('honours EXPO_PUBLIC_EMULATOR_HOST', () => {
    const c = readConfig({ EXPO_PUBLIC_BACKEND: 'emulator', EXPO_PUBLIC_EMULATOR_HOST: '192.168.1.5' });
    expect(c.emulatorHost).toBe('192.168.1.5');
  });

  it('reads firebase keys for the firebase backend', () => {
    const c = readConfig({
      EXPO_PUBLIC_BACKEND: 'firebase',
      EXPO_PUBLIC_FIREBASE_API_KEY: 'k',
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'a',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'p',
      EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 's',
      EXPO_PUBLIC_FIREBASE_APP_ID: 'i',
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'm',
    });
    expect(c.firebase).toEqual({
      apiKey: 'k', authDomain: 'a', projectId: 'p', storageBucket: 's', appId: 'i', messagingSenderId: 'm',
    });
  });

  it('throws naming the missing key for the firebase backend', () => {
    expect(() => readConfig({ EXPO_PUBLIC_BACKEND: 'firebase' })).toThrow('Missing EXPO_PUBLIC_FIREBASE_API_KEY');
    expect(() =>
      readConfig({
        EXPO_PUBLIC_BACKEND: 'firebase',
        EXPO_PUBLIC_FIREBASE_API_KEY: 'k',
        EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'a',
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'p',
        EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 's',
        EXPO_PUBLIC_FIREBASE_APP_ID: 'i',
      }),
    ).toThrow('Missing EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
  });

  it('throws on an unknown backend', () => {
    expect(() => readConfig({ EXPO_PUBLIC_BACKEND: 'x' })).toThrow('Unknown EXPO_PUBLIC_BACKEND: x');
  });
});
