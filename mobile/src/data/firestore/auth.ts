import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { DEFAULT_NOTIFICATION_PREFS, validateDisplayName } from '@/domain/profiles';
import type { AuthSession } from '@/domain/types';
import { BAD_CREDENTIALS, EMAIL_IN_USE, INCORRECT_PASSWORD, NOT_SIGNED_IN } from '../errors';
import type { AuthRepository, ProfileRepository, UserRepository } from '../types';

const WRONG_PASSWORD_CODES = new Set([
  'auth/invalid-credential',
  'auth/wrong-password',
  'auth/invalid-login-credentials',
]);
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
  profiles: ProfileRepository,
  now: () => Date = () => new Date(),
): AuthRepository {
  // onAuthStateChanged fires as soon as the account exists, before the name, the users doc and the
  // public profile are written. A session emitted then would mount the signed-in app mid-register
  // (and its profile repair could race the real name), so sign-ins are held back while registering
  // and the current session is emitted once register settles, whether it succeeded or not.
  const listeners = new Set<(s: AuthSession | null) => void>();
  let registering = false;

  async function createAccount(
    email: string,
    password: string,
    displayName: string,
    acceptedTermsAt: Date,
  ): Promise<AuthSession> {
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
      notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
      acceptedTermsAt,
      createdAt: at,
      updatedAt: at,
    });
    await profiles.setDisplayName(user.uid, displayName, at);
    return { userId: user.uid, email: user.email ?? email, displayName };
  }

  return {
    subscribe(cb) {
      listeners.add(cb);
      const unsub = onAuthStateChanged(auth, (u) => {
        if (registering && u) return;
        cb(u ? toSession(u) : null);
      });
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
    async register(email, password, rawName, acceptedTermsAt) {
      // Checked before the account exists: the publicProfiles rules refuse other names.
      const nameError = validateDisplayName(rawName);
      if (nameError !== null) throw new Error(nameError);
      const displayName = rawName.trim();
      registering = true;
      try {
        return await createAccount(email, password, displayName, acceptedTermsAt);
      } finally {
        registering = false;
        const current = auth.currentUser;
        const session = current ? toSession(current) : null;
        for (const cb of listeners) cb(session);
      }
    },
    async signOut() {
      await signOut(auth);
    },
    async deleteAccount(password) {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error(NOT_SIGNED_IN);
      try {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      } catch (e) {
        if (WRONG_PASSWORD_CODES.has(errorCode(e) ?? '')) throw new Error(INCORRECT_PASSWORD);
        throw e;
      }
      // Server-side `cleanupDeletedUser` (Auth onDelete) removes the profile, memories and files.
      await deleteUser(user);
    },
    async sendEmailVerification() {
      const user = auth.currentUser;
      if (!user) throw new Error(NOT_SIGNED_IN);
      await sendEmailVerification(user);
    },
    async refreshUser() {
      const user = auth.currentUser;
      if (!user) throw new Error(NOT_SIGNED_IN);
      // The forced refresh mints a token with the current claims (verified email, staff) for the
      // callables, from the refresh token, so it also works after an account change invalidated
      // the cached ID token; reload() then updates the local user's emailVerified.
      const token = await user.getIdTokenResult(true);
      await reload(user);
      return { email: user.email ?? '', emailVerified: user.emailVerified, staff: token.claims.staff === true };
    },
  };
}
