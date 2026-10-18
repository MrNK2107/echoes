import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import type { AuthSession } from '@/domain/types';
import type { AuthRepository, UserRepository } from '../types';

const BAD_CREDENTIALS = 'Incorrect email or password.';
const EMAIL_IN_USE = 'An account already exists for that email.';
const BAD_CREDENTIAL_CODES = new Set([
  'auth/invalid-credential',
  'auth/wrong-password',
  'auth/user-not-found',
  'auth/invalid-login-credentials',
]);

function errorCode(e: unknown): string | null {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const { code } = e as { code: unknown };
    return typeof code === 'string' ? code : null;
  }
  return null;
}

function toSession(u: User): AuthSession {
  return { userId: u.uid, email: u.email ?? '', displayName: u.displayName };
}

export function createAuthRepository(
  auth: Auth,
  users: UserRepository,
  now: () => Date = () => new Date(),
): AuthRepository {
  // onAuthStateChanged fires before updateProfile during register; re-emit once the name is set.
  const listeners = new Set<(s: AuthSession | null) => void>();
  return {
    subscribe(cb) {
      listeners.add(cb);
      const unsub = onAuthStateChanged(auth, (u) => cb(u ? toSession(u) : null));
      return () => {
        listeners.delete(cb);
        unsub();
      };
    },
    async signIn(email, password) {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return toSession(cred.user);
      } catch (e) {
        if (BAD_CREDENTIAL_CODES.has(errorCode(e) ?? '')) throw new Error(BAD_CREDENTIALS);
        throw e;
      }
    },
    async register(email, password, displayName) {
      let user: User;
      try {
        user = (await createUserWithEmailAndPassword(auth, email, password)).user;
      } catch (e) {
        if (errorCode(e) === 'auth/email-already-in-use') throw new Error(EMAIL_IN_USE);
        throw e;
      }
      await updateProfile(user, { displayName });
      const at = now();
      await users.create({
        id: user.uid,
        displayName,
        email: user.email,
        photoUrl: null,
        defaultPrivacy: 'public',
        managedPlaceIds: [],
        communityIds: [],
        createdAt: at,
        updatedAt: at,
      });
      const session: AuthSession = { userId: user.uid, email: user.email ?? email, displayName };
      if (auth.currentUser?.uid === user.uid) for (const cb of listeners) cb(session);
      return session;
    },
    async signOut() {
      await signOut(auth);
    },
  };
}
