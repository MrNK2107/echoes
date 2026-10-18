import type { Repositories } from '../types';
import { createAuthRepository } from './auth';
import { createCommunityRepository } from './communities';
import { createInstitutionRepository } from './institutions';
import { createMediaRepository } from './media';
import { createMemoryRepository } from './memories';
import { createNotificationRepository } from './notifications';
import { createPlaceRepository } from './places';
import { createProfileRepository } from './profiles';
import { createSafetyRepository } from './safety';
import { Store, type MemoryBackendOptions, type MemorySeed } from './store';
import { createTransferRepository } from './transfers';
import { createUserRepository } from './users';

export type { MemorySeed, MemoryBackendOptions } from './store';

/** What the Auth emulator's admin API (or the Admin SDK) can change on an account. */
export interface MemoryBackendAdmin {
  /** Updates the account with this uid; the signed-in session follows an email change. */
  updateAccount(uid: string, patch: { email?: string; emailVerified?: boolean; staff?: boolean }): void;
}

export function createMemoryBackendWithAdmin(
  seed?: MemorySeed,
  options?: MemoryBackendOptions,
): { repos: Repositories; admin: MemoryBackendAdmin } {
  const store = new Store(seed, options);
  const repos: Repositories = {
    places: createPlaceRepository(store),
    memories: createMemoryRepository(store),
    users: createUserRepository(store),
    auth: createAuthRepository(store),
    media: createMediaRepository(),
    profiles: createProfileRepository(store),
    notifications: createNotificationRepository(store),
    safety: createSafetyRepository(store),
    communities: createCommunityRepository(store),
    transfers: createTransferRepository(store),
    institutions: createInstitutionRepository(store),
  };
  const admin: MemoryBackendAdmin = {
    updateAccount(uid, patch) {
      const account = store.accountOf(uid);
      if (!account) throw new Error(`No account for ${uid}`);
      if (patch.email !== undefined && patch.email !== account.email) {
        store.accounts.delete(account.email.toLowerCase());
        account.email = patch.email;
        store.accounts.set(patch.email.toLowerCase(), account);
        if (store.session?.userId === uid) store.session = { ...store.session, email: patch.email };
      }
      if (patch.emailVerified !== undefined) account.emailVerified = patch.emailVerified;
      if (patch.staff !== undefined) account.staff = patch.staff;
    },
  };
  return { repos, admin };
}

export function createMemoryBackend(seed?: MemorySeed, options?: MemoryBackendOptions): Repositories {
  return createMemoryBackendWithAdmin(seed, options).repos;
}
