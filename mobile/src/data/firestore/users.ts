import { doc, getDoc, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { notificationPrefsToDoc, userFromDoc, userToDoc } from '../mappers';
import type { UserRepository } from '../types';

export function createUserRepository(db: Firestore): UserRepository {
  return {
    async get(id) {
      const snap = await getDoc(doc(db, 'users', id));
      const data = snap.data();
      return data === undefined ? null : userFromDoc(snap.id, data);
    },
    async create(user) {
      await setDoc(doc(db, 'users', user.id), userToDoc(user));
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
