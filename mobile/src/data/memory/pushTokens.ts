import type { PushTokenRepository } from '../types';
import type { Store } from './store';

const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export function createPushTokenRepository(store: Store): PushTokenRepository {
  const tokens = (uid: string) => {
    let m = store.pushTokens.get(uid);
    if (!m) store.pushTokens.set(uid, (m = new Map()));
    return m;
  };
  return {
    async register(uid, token, platform, at) {
      const mine = tokens(uid);
      const existing = mine.get(token);
      if (!existing) {
        mine.set(token, { token, platform, createdAt: at, lastSeenAt: at });
      } else if (at.getTime() - existing.lastSeenAt.getTime() > REFRESH_AFTER_MS) {
        mine.set(token, { ...existing, lastSeenAt: at });
      }
    },
    async unregister(uid, token) {
      store.pushTokens.get(uid)?.delete(token);
    },
    async get(uid, token) {
      return store.pushTokens.get(uid)?.get(token) ?? null;
    },
  };
}
