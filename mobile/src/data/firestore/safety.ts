import { collection, deleteDoc, doc, orderBy, query, setDoc, type Firestore } from 'firebase/firestore';
import { httpsCallable, type Functions } from 'firebase/functions';
import { mapCallableError, REPORT_ERRORS } from '../callableErrors';
import { GENERIC_ERROR } from '../errors';
import type { SafetyRepository } from '../types';
import { subscribeUnion } from './snapshots';

export function createSafetyRepository(db: Firestore, functions: Functions): SafetyRepository {
  const blocks = (uid: string) => collection(db, 'users', uid, 'blocks');
  const reportMemory = httpsCallable<{ memoryId: string; reason: string; note?: string }, unknown>(
    functions,
    'reportMemory',
  );
  return {
    async block(uid, other, at) {
      // The rules refuse a self-block (otherUserId != userId); fail with copy instead.
      if (uid === other) throw new Error(GENERIC_ERROR);
      await setDoc(doc(blocks(uid), other), { createdAt: at.toISOString() });
    },
    async unblock(uid, other) {
      await deleteDoc(doc(blocks(uid), other));
    },
    subscribeBlocks(uid, cb, onError) {
      // Deliberately unbounded (an exception to the limit(50) rule): the client hides every
      // blocked user's content (ADR-0008), so a capped list would silently stop hiding the
      // oldest blocks. The docs are tiny ({ createdAt }).
      const q = query(blocks(uid), orderBy('createdAt', 'desc'));
      return subscribeUnion(
        [q],
        (docs) =>
          cb(
            docs
              .map((d) => ({ id: d.id, at: String(d.data().createdAt) }))
              .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
              .map((b) => b.id),
          ),
        onError,
      );
    },
    async reportMemory({ memoryId, reason, note }) {
      const trimmed = note?.trim();
      try {
        // The callable treats an absent note as "no note"; send none rather than an empty one.
        await reportMemory(trimmed ? { memoryId, reason, note: trimmed } : { memoryId, reason });
      } catch (e) {
        throw mapCallableError(e, REPORT_ERRORS);
      }
    },
  };
}
