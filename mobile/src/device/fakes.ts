import { createMemoryBackend } from '@/data/memory';
import { buildSeed, DEMO_CENTER } from '@/data/seed';
import type { LatLng } from '@/domain/types';
import { readConfig } from '@/services/config';
import type { Services } from '@/services/services';

import type { ImagePickerService, LocationService } from './types';

export const SEED_CENTER: LatLng = DEMO_CENTER;
export const TEST_NOW = new Date('2026-10-18T09:00:00Z');

export function fakeLocation(
  r: { permission?: 'granted' | 'denied'; position?: LatLng; error?: Error } = {},
): LocationService {
  return {
    requestPermission: async () => r.permission ?? 'granted',
    getCurrentPosition: async () => {
      if (r.error) throw r.error;
      return r.position ?? SEED_CENTER;
    },
  };
}

export function fakeImagePicker(result: Awaited<ReturnType<ImagePickerService['pick']>>): ImagePickerService {
  return { pick: async () => result };
}

export function testServices(overrides: Partial<Services> = {}): Services {
  let n = 0;
  const now = overrides.now ?? (() => new Date(TEST_NOW));
  return {
    config: readConfig({}),
    repos: createMemoryBackend(buildSeed(new Date(TEST_NOW), SEED_CENTER), { now }),
    location: fakeLocation({}),
    imagePicker: fakeImagePicker(null),
    now,
    newId: () => `id-${++n}`,
    ...overrides,
  };
}
