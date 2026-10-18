import { renderHook } from '@testing-library/react-native';

import { testServices } from '@/device/fakes';

import { readConfig } from './config';
import { createServices } from './createServices';
import { useServices } from './ServicesProvider';

describe('createServices', () => {
  it('memory mode returns seeded repositories', async () => {
    const s = createServices(readConfig({}));
    const place = await s.repos.places.findNearest({
      center: { latitude: 12.9716, longitude: 77.5946 },
      radiusMeters: 5000,
    });
    expect(place).not.toBeNull();
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
