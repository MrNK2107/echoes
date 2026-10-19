import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';

import type { Repositories } from '@/data/types';
import type { ConnectivityService } from '@/device/types';
import { createMemoryBackend } from '@/data/memory';
import { buildSeed, DEMO_CENTER } from '@/data/seed';
import { expoAudioPlayer, expoAudioRecorder } from '@/device/expoAudio';
import { expoConnectivity } from '@/device/expoNetwork';
import { expoImagePicker } from '@/device/expoImagePicker';
import { demoLocation } from '@/device/demoLocation';
import { expoLocation } from '@/device/expoLocation';
import { outboxFiles } from '@/device/fileStore';
import { expoPush } from '@/device/expoPush';
import { unavailablePush } from '@/device/unavailablePush';
import { asyncKeyValue } from '@/device/keyValueStore';

import type { AppConfig } from './config';
import type { Services } from './services';

export type { Services } from './services';

/**
 * Firebase is required lazily so memory mode (and Jest) never loads the SDK; its
 * react-native build is ESM-only and is not transformed by jest-expo.
 */
function createFirebaseRepos(config: AppConfig, connectivity: ConnectivityService): Repositories {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { createFirestoreBackend } = require('@/data/firestore') as typeof import('@/data/firestore');
  const { initFirebase } = require('./firebase') as typeof import('./firebase');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return createFirestoreBackend({ ...initFirebase(config), isOnline: () => connectivity.isOnline(),
    sha256Hex: (value) => digestStringAsync(CryptoDigestAlgorithm.SHA256, value),
  });
}

export function createServices(config: AppConfig, overrides: Partial<Services> = {}): Services {
  const now = overrides.now ?? (() => new Date());
  const connectivity = overrides.connectivity ?? expoConnectivity;
  const repos =
    config.backend === 'memory'
      ? createMemoryBackend(buildSeed(now()), { now })
      : createFirebaseRepos(config, connectivity);
  return {
    config,
    repos,
    // Memory mode pins the user to the seed's neighbourhood so the demo map is never empty.
    location: config.backend === 'memory' ? demoLocation(DEMO_CENTER) : expoLocation,
    imagePicker: expoImagePicker,
    connectivity,
    keyValue: asyncKeyValue,
    files: outboxFiles,
    audioRecorder: expoAudioRecorder,
    audioPlayer: expoAudioPlayer,
    // Demo mode has no push backend; it shows the unavailable copy instead of touching native code.
    push: config.backend === 'memory' ? unavailablePush : expoPush,
    now,
    newId: () => randomUUID(),
    ...overrides,
  };
}
