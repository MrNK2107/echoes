import type { Repositories } from '../types';
import { createAuthRepository } from './auth';
import { createMediaRepository } from './media';
import { createMemoryRepository } from './memories';
import { createNotificationRepository } from './notifications';
import { createPlaceRepository } from './places';
import { createProfileRepository } from './profiles';
import { createSafetyRepository } from './safety';
import { Store, type MemoryBackendOptions, type MemorySeed } from './store';
import { createUserRepository } from './users';

export type { MemorySeed, MemoryBackendOptions } from './store';

export function createMemoryBackend(seed?: MemorySeed, options?: MemoryBackendOptions): Repositories {
  const store = new Store(seed, options);
  return {
    places: createPlaceRepository(store),
    memories: createMemoryRepository(store),
    users: createUserRepository(store),
    auth: createAuthRepository(store),
    media: createMediaRepository(),
    profiles: createProfileRepository(store),
    notifications: createNotificationRepository(store),
    safety: createSafetyRepository(store),
  };
}
