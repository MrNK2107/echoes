import type { AuthSession } from '@/domain/types';
import type { AuthRepository } from '../types';
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
      const session = { userId: acct.userId, email, displayName };
      setSession(session);
      return session;
    },
    async signOut() {
      setSession(null);
    },
  };
}
