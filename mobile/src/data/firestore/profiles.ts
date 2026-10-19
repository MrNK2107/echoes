import { updateProfile, type Auth } from 'firebase/auth';
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { searchRange } from '@/domain/communities';
import { validateDisplayName } from '@/domain/profiles';
import type { PublicProfile } from '@/domain/types';
import { profileFromDoc, profileToDoc } from '../mappers';
import type { ProfileRepository } from '../types';

const SEARCH_LIMIT = 10;
/** Firestore's cap on `in` values. */
const IN_CHUNK = 30;

/**
 * `auth`, when given, lets setDisplayName keep the Auth profile name in step. The live session
 * object keeps its old `displayName` until the next auth state change; screens read the public
 * profile (or the users doc) instead.
 */
export function createProfileRepository(db: Firestore, auth?: Auth): ProfileRepository {
  const profiles = collection(db, 'publicProfiles');
  return {
    async get(uid) {
      const snap = await getDoc(doc(profiles, uid));
      const data = snap.data();
      return data === undefined ? null : profileFromDoc(snap.id, data);
    },
    async getMany(uids) {
      const ids = [...new Set(uids)];
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK));
      const snaps = await Promise.all(
        chunks.map((c) => getDocs(query(profiles, where(documentId(), 'in', c)))),
      );
      const out = new Map<string, PublicProfile>();
      for (const snap of snaps) for (const d of snap.docs) out.set(d.id, profileFromDoc(d.id, d.data()));
      return out;
    },
    async search(text, opts) {
      const range = searchRange(text);
      if (range === null) return [];
      // A range on one field orders by it and needs only the automatic single-field index. One
      // extra result leaves room to drop the excluded user and still return up to 10.
      const extra = opts.excludeUid === undefined ? 0 : 1;
      const snap = await getDocs(
        query(
          profiles,
          where('displayNameLower', '>=', range.start),
          where('displayNameLower', '<', range.end),
          limit(SEARCH_LIMIT + extra),
        ),
      );
      return snap.docs
        .filter((d) => d.id !== opts.excludeUid)
        .slice(0, SEARCH_LIMIT)
        .map((d) => profileFromDoc(d.id, d.data()));
    },
    async setDisplayName(uid, name, at) {
      const error = validateDisplayName(name);
      if (error !== null) throw new Error(error);
      await setDoc(doc(profiles, uid), profileToDoc(name, at));
      // Best effort: the public profile is the name others see. A missing users doc (an account
      // registered before Plan 3 finished) or a failed Auth update must not fail the rename.
      const displayName = name.trim();
      await updateDoc(doc(db, 'users', uid), { displayName, updatedAt: at.toISOString() }).catch((e: unknown) =>
        console.warn('Could not sync the users doc name', e),
      );
      const user = auth?.currentUser;
      if (user && user.uid === uid) {
        await updateProfile(user, { displayName }).catch((e: unknown) =>
          console.warn('Could not sync the Auth profile name', e),
        );
      }
    },
  };
}
