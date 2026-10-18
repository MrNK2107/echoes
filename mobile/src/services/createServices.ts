import { randomUUID } from 'expo-crypto';

import type { Repositories } from '@/data/types';
import { createMemoryBackend } from '@/data/memory';
import { buildSeed, DEMO_CENTER } from '@/data/seed';
import { expoImagePicker } from '@/device/expoImagePicker';
import { demoLocation } from '@/device/demoLocation';
import { expoLocation } from '@/device/expoLocation';

import type { AppConfig } from './config';
import type { Services } from './services';

export type { Services } from './services';

/**
 * Firebase is required lazily so memory mode (and Jest) never loads the SDK; its
 * react-native build is ESM-only and is not transformed by jest-expo.
 */
function createFirebaseRepos(config: AppConfig): Repositories {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { createFirestoreBackend } = require('@/data/firestore') as typeof import('@/data/firestore');
  const { initFirebase } = require('./firebase') as typeof import('./firebase');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return createFirestoreBackend(initFirebase(config));
}

export function createServices(config: AppConfig, overrides: Partial<Services> = {}): Services {
  const now = overrides.now ?? (() => new Date());
  const repos =
    config.backend === 'memory'
      ? createMemoryBackend(buildSeed(now()), { now })
      : createFirebaseRepos(config);
  return {
    config,
    repos,
    // Memory mode pins the user to the seed's neighbourhood so the demo map is never empty.
    location: config.backend === 'memory' ? demoLocation(DEMO_CENTER) : expoLocation,
    imagePicker: expoImagePicker,
    now,
    newId: () => randomUUID(),
    ...overrides,
  };
}
