import { searchRange } from '@/domain/communities';
import { validateDisplayName } from '@/domain/profiles';
import type { PublicProfile } from '@/domain/types';
import type { ProfileRepository } from '../types';
import type { Store } from './store';

const SEARCH_LIMIT = 10;

export function createProfileRepository(store: Store): ProfileRepository {
  const toProfile = (id: string): PublicProfile | null => {
    const p = store.profiles.get(id);
    return p ? { id, displayName: p.displayName } : null;
  };
  return {
    async get(uid) {
      return toProfile(uid);
    },
    async getMany(uids) {
      const out = new Map<string, PublicProfile>();
      for (const uid of uids) {
        const p = toProfile(uid);
        if (p) out.set(uid, p);
      }
      return out;
    },
    async search(query, opts) {
      const range = searchRange(query);
      if (range === null) return [];
      // Same order as the Firestore range query: displayNameLower, then document id.
      return [...store.profiles.entries()]
        .filter(([, p]) => p.displayNameLower >= range.start && p.displayNameLower < range.end)
        .sort(([aId, a], [bId, b]) =>
          a.displayNameLower < b.displayNameLower ? -1 : a.displayNameLower > b.displayNameLower ? 1 : aId < bId ? -1 : 1,
        )
        .filter(([id]) => id !== opts.excludeUid)
        .slice(0, SEARCH_LIMIT)
        .map(([id, p]) => ({ id, displayName: p.displayName }));
    },
    async setDisplayName(uid, name, at) {
      const error = validateDisplayName(name);
      if (error !== null) throw new Error(error);
      store.setProfile(uid, name, at);
      // Keep the users doc, the account and the live session on the same name (the Firestore
      // backend updates the users doc and the Auth profile).
      const displayName = name.trim();
      const user = store.users.get(uid);
      if (user) store.users.set(uid, { ...user, displayName, updatedAt: at });
      const account = store.accountOf(uid);
      if (account) account.displayName = displayName;
      if (store.session?.userId === uid) {
        store.session = { ...store.session, displayName };
        store.notify(store.authListeners);
      }
    },
  };
}
