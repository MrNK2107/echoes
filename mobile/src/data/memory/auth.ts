import type { AuthSession } from '@/domain/types';
import type { AuthRepository } from '../types';
import { recomputePlace } from './recompute';
import type { Store } from './store';

export function createAuthRepository(store: Store): AuthRepository {
  const setSession = (s: AuthSession | null) => {
    store.session = s;
    store.notify(store.authListeners);
  };
  return {
    subscribe(cb) {
      const emit = () => cb(store.session);
      store.authListeners.add(emit);
      emit();
      return () => { store.authListeners.delete(emit); };
    },
    async signIn(email, password) {
      const acct = store.accounts.get(email.toLowerCase());
      if (!acct || acct.password !== password) throw new Error('Incorrect email or password.');
      const session = { userId: acct.userId, email: acct.email, displayName: acct.displayName };
      setSession(session);
      return session;
    },
    async register(email, password, displayName) {
      const key = email.toLowerCase();
      if (store.accounts.has(key)) throw new Error('An account already exists for that email.');
      const acct = { userId: store.nextUserId(), email, password, displayName };
      store.accounts.set(key, acct);
      const at = store.now();
      store.users.set(acct.userId, {
        id: acct.userId, displayName, email, photoUrl: null, defaultPrivacy: 'public',
        managedPlaceIds: [], communityIds: [], createdAt: at, updatedAt: at,
      });
      const session = { userId: acct.userId, email, displayName };
      setSession(session);
      return session;
    },
    async signOut() {
      setSession(null);
    },
    async deleteAccount(password) {
      const session = store.session;
      if (!session) throw new Error('Not signed in.');
      const acct = store.accounts.get(session.email.toLowerCase());
      if (!acct || acct.password !== password) throw new Error('Incorrect password.');
      const placeIds = new Set<string>();
      for (const [id, m] of [...store.memories]) {
        if (m.userId !== session.userId) continue;
        placeIds.add(m.placeId);
        store.memories.delete(id);
      }
      for (const placeId of placeIds) recomputePlace(store, placeId);
      store.users.delete(session.userId);
      store.accounts.delete(acct.email.toLowerCase());
      store.notify(store.memoryListeners);
      store.notify(store.placeListeners);
      setSession(null);
    },
  };
}
