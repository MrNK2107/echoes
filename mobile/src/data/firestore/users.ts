import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { userFromDoc, userToDoc } from '../mappers';
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
  };
}
