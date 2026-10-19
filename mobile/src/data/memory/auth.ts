import { DEFAULT_NOTIFICATION_PREFS, validateDisplayName } from '@/domain/profiles';
import type { AuthSession } from '@/domain/types';
import { BAD_CREDENTIALS, EMAIL_IN_USE, INCORRECT_PASSWORD, NOT_SIGNED_IN } from '../errors';
import type { AuthRepository } from '../types';
import { cleanupUserCommunities } from './autoCommunities';
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
      if (!acct || acct.password !== password) throw new Error(BAD_CREDENTIALS);
      const session = { userId: acct.userId, email: acct.email, displayName: acct.displayName };
      setSession(session);
      return session;
    },
    async register(email, password, rawName, acceptedTermsAt) {
      const nameError = validateDisplayName(rawName);
      if (nameError !== null) throw new Error(nameError);
      const displayName = rawName.trim();
      const key = email.toLowerCase();
      if (store.accounts.has(key)) throw new Error(EMAIL_IN_USE);
      const acct = { userId: store.nextUserId(), email, password, displayName };
      store.accounts.set(key, acct);
      const at = store.now();
      store.users.set(acct.userId, {
        id: acct.userId, displayName, email, photoUrl: null, defaultPrivacy: 'public',
        managedPlaceIds: [], communityIds: [], notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
        acceptedTermsAt, createdAt: at, updatedAt: at,
      });
      store.setProfile(acct.userId, displayName, at);
      const session = { userId: acct.userId, email, displayName };
      setSession(session);
      return session;
    },
    async signOut() {
      setSession(null);
    },
    async deleteAccount(password) {
      const session = store.session;
      if (!session) throw new Error(NOT_SIGNED_IN);
      const acct = store.accounts.get(session.email.toLowerCase());
      if (!acct || acct.password !== password) throw new Error(INCORRECT_PASSWORD);
      const placeIds = new Set<string>();
      for (const [id, m] of [...store.memories]) {
        if (m.userId !== session.userId) continue;
        placeIds.add(m.placeId);
        store.memories.delete(id);
      }
      for (const placeId of placeIds) recomputePlace(store, placeId);
      // cleanupDeletedUser: the users doc with its inbox and blocks, and the public profile.
      store.users.delete(session.userId);
      store.profiles.delete(session.userId);
      store.notifications.delete(session.userId);
      store.pushTokens.delete(session.userId);
      store.blocks.delete(session.userId);
      cleanupUserCommunities(store, session.userId);
      store.accounts.delete(acct.email.toLowerCase());
      store.notify(store.memoryListeners);
      store.notify(store.placeListeners);
      store.notify(store.notificationListeners);
      store.notify(store.blockListeners);
      store.notify(store.communityListeners);
      store.notify(store.institutionListeners);
      setSession(null);
    },
    async sendEmailVerification() {
      const account = store.session ? store.accountOf(store.session.userId) : null;
      if (!account) throw new Error(NOT_SIGNED_IN);
      // Demo mode has no inbox to click a link in, so sending the email verifies the address.
      account.emailVerified = true;
    },
    async refreshUser() {
      const account = store.session ? store.accountOf(store.session.userId) : null;
      if (!account) throw new Error(NOT_SIGNED_IN);
      return { email: account.email, emailVerified: account.emailVerified === true, staff: account.staff === true };
    },
  };
}
