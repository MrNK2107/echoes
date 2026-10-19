import { doc, getDoc, runTransaction, updateDoc, type Firestore } from 'firebase/firestore';
import { notificationPrefsToDoc, userFromDoc, userToDoc } from '../mappers';
import { USER_EXISTS } from '../errors';
import type { UserRepository } from '../types';

export function createUserRepository(db: Firestore): UserRepository {
  return {
    async get(id) {
      const snap = await getDoc(doc(db, 'users', id));
      const data = snap.data();
      return data === undefined ? null : userFromDoc(snap.id, data);
    },
    async create(user) {
      // Create-only: a doc that already exists (a concurrent or repeated repair) is never overwritten.
      const ref = doc(db, 'users', user.id);
      await runTransaction(db, async (tx) => {
        if ((await tx.get(ref)).exists()) throw new Error(USER_EXISTS);
        tx.set(ref, userToDoc(user));
      });
    },
    async updateDefaultPrivacy(userId, privacy, at) {
      // Users docs store dates as ISO strings (see userToDoc).
      await updateDoc(doc(db, 'users', userId), { defaultPrivacy: privacy, updatedAt: at.toISOString() });
    },
    async updateNotificationPrefs(userId, prefs, at) {
      await updateDoc(doc(db, 'users', userId), {
        notificationPrefs: notificationPrefsToDoc(prefs),
        updatedAt: at.toISOString(),
      });
    },
  };
}
