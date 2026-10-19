import { USER_EXISTS } from '../errors';
import type { UserRepository } from '../types';
import type { Store } from './store';

export function createUserRepository(store: Store): UserRepository {
  return {
    async get(id) {
      return store.users.get(id) ?? null;
    },
    async create(user) {
      // Create-only, like the Firestore transaction: an existing doc is never overwritten.
      if (store.users.has(user.id)) throw new Error(USER_EXISTS);
      store.users.set(user.id, user);
    },
    async updateDefaultPrivacy(userId, privacy, at) {
      const u = store.users.get(userId);
      if (!u) throw new Error('User not found.');
      store.users.set(userId, { ...u, defaultPrivacy: privacy, updatedAt: at });
    },
    async updateNotificationPrefs(userId, prefs, at) {
      const u = store.users.get(userId);
      if (!u) throw new Error('User not found.');
      store.users.set(userId, { ...u, notificationPrefs: { ...prefs }, updatedAt: at });
    },
  };
}
