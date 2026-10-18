import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import type { Repositories } from '../types';
import { createAuthRepository } from './auth';
import { createMediaRepository } from './media';
import { createMemoryRepository } from './memories';
import { createPlaceRepository } from './places';
import { createUserRepository } from './users';

export function createFirestoreBackend(deps: {
  db: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
}): Repositories {
  const users = createUserRepository(deps.db);
  return {
    places: createPlaceRepository(deps.db),
    memories: createMemoryRepository(deps.db),
    users,
    auth: createAuthRepository(deps.auth, users),
    media: createMediaRepository(deps.storage),
  };
}
