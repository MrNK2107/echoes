import { renderHook } from '@testing-library/react-native';

import { DEMO_CENTER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { expoLocation } from '@/device/expoLocation';

import { readConfig } from './config';
import { createServices } from './createServices';
import { useServices } from './ServicesProvider';

// The Firebase SDK is ESM-only and not transformed by jest-expo; stub the lazily required modules.
jest.mock('@/data/firestore', () => ({ createFirestoreBackend: () => ({}) }));
jest.mock('./firebase', () => ({ initFirebase: () => ({}) }));

describe('createServices', () => {
  it('memory mode returns seeded repositories', async () => {
    const s = createServices(readConfig({}));
    const place = await s.repos.places.findNearest({
      center: { latitude: 12.9716, longitude: 77.5946 },
      radiusMeters: 5000,
    });
    expect(place).not.toBeNull();
  });

  it('memory mode uses a demo location pinned to the seed centre', async () => {
    const s = createServices(readConfig({}));
    await expect(s.location.requestPermission()).resolves.toBe('granted');
    await expect(s.location.getCurrentPosition()).resolves.toEqual(DEMO_CENTER);
  });

  it('emulator mode keeps the real location service', () => {
    const s = createServices(readConfig({ EXPO_PUBLIC_BACKEND: 'emulator' }));
    expect(s.location).toBe(expoLocation);
  });

  it('overrides win over the demo location', () => {
    const location = testServices().location;
    expect(createServices(readConfig({}), { location }).location).toBe(location);
  });

  it('allows overriding services', () => {
    const now = () => new Date(0);
    const s = createServices(readConfig({}), { now });
    expect(s.now()).toEqual(new Date(0));
  });

  it('generates distinct ids', () => {
    const s = createServices(readConfig({}));
    expect(s.newId()).not.toBe(s.newId());
  });
});

describe('testServices', () => {
  it('has deterministic ids', () => {
    const s = testServices();
    expect([s.newId(), s.newId()]).toEqual(['id-1', 'id-2']);
  });
});

describe('useServices', () => {
  it('throws outside a provider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(async () => renderHook(() => useServices())).rejects.toThrow(
      'useServices must be used inside ServicesProvider',
    );
    spy.mockRestore();
  });
});
