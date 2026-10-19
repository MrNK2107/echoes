import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import type { FirebaseStorage } from 'firebase/storage';
import type { Repositories } from '../types';
import { createAuthRepository } from './auth';
import { createCommunityRepository } from './communities';
import { createInstitutionRepository } from './institutions';
import { createMediaRepository } from './media';
import { createMemoryRepository } from './memories';
import { createNotificationRepository } from './notifications';
import { createPlaceRepository } from './places';
import { createProfileRepository } from './profiles';
import { createPushTokenRepository } from './pushTokens';
import { createSafetyRepository } from './safety';
import { createTransferRepository } from './transfers';
import { createUserRepository } from './users';

export function createFirestoreBackend(deps: {
  db: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
  functions: Functions;
  /** Device connectivity; callables report failures while offline as TIMEOUT_ERROR. */
  isOnline(): Promise<boolean>;
  /** Hex SHA-256 of a string (expo-crypto in the app); names push token documents. */
  sha256Hex(value: string): Promise<string>;
}): Repositories {
  const callables = { functions: deps.functions, isOnline: deps.isOnline };
  const users = createUserRepository(deps.db);
  const profiles = createProfileRepository(deps.db, deps.auth);
  return {
    places: createPlaceRepository(deps.db),
    memories: createMemoryRepository(deps.db),
    users,
    auth: createAuthRepository(deps.auth, users, profiles),
    media: createMediaRepository(deps.storage),
    profiles,
    notifications: createNotificationRepository(deps.db),
    safety: createSafetyRepository(deps.db, callables),
    communities: createCommunityRepository(deps.db, callables),
    transfers: createTransferRepository(deps.db, callables),
    institutions: createInstitutionRepository(deps.db, deps.auth, callables),
    pushTokens: createPushTokenRepository(deps.db, deps.sha256Hex),
  };
}
