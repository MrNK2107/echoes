import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { GENERIC_ERROR } from '../errors';
import { notificationFromDoc } from '../mappers';
import type { NotificationRepository } from '../types';
import { subscribeUnion } from './snapshots';

const LIST_LIMIT = 50;
/** markAllRead pages through unread items; this bounds the loop. */
const MAX_MARK_ALL_PAGES = 20;

export function createNotificationRepository(db: Firestore): NotificationRepository {
  const inbox = (uid: string) => collection(db, 'users', uid, 'notifications');
  return {
    subscribe(uid, cb, onError) {
      const q = query(inbox(uid), orderBy('createdAt', 'desc'), limit(LIST_LIMIT));
      return subscribeUnion(
        [q],
        (docs) =>
          cb(
            docs
              .map((d) => notificationFromDoc(d.id, d.data()))
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
          ),
        onError,
      );
    },
    async markRead(uid, id, at) {
      // The rules let the owner change only readAt, and only to a string. A missing or foreign
      // notification (not-found / permission-denied) must not surface the SDK's raw message.
      try {
        await updateDoc(doc(inbox(uid), id), { readAt: at.toISOString() });
      } catch {
        throw new Error(GENERIC_ERROR);
      }
    },
    async markAllRead(uid, at) {
      try {
        await markAllPages(uid, at);
      } catch {
        throw new Error(GENERIC_ERROR);
      }
    },
  };

  async function markAllPages(uid: string, at: Date): Promise<void> {
    // Uses the (readAt, createdAt desc) index in firestore.indexes.json.
    for (let page = 0; page < MAX_MARK_ALL_PAGES; page += 1) {
      const snap = await getDocs(
        query(inbox(uid), where('readAt', '==', null), orderBy('createdAt', 'desc'), limit(LIST_LIMIT)),
      );
      if (snap.empty) return;
      const batch = writeBatch(db);
      for (const d of snap.docs) batch.update(d.ref, { readAt: at.toISOString() });
      await batch.commit();
      if (snap.size < LIST_LIMIT) return;
    }
  }
}
