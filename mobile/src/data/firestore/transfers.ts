import { collection, limit, orderBy, query, where, type DocumentData, type Firestore, type Query } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import type { Transfer } from '@/domain/types';
import { TRANSFER_INITIATE_ERRORS } from '../callableErrors';
import { transferFromDoc } from '../mappers';
import type { TransferRepository } from '../types';
import { callCallable } from './callables';
import { subscribeUnion } from './snapshots';

const LIST_LIMIT = 50;

const newestFirst = (a: Transfer, b: Transfer) =>
  b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1);

/**
 * Transfers are read directly (the rules allow the sender and the recipient) and changed only
 * through the callables in functions/transfers.js (ADR-0007).
 */
export function createTransferRepository(db: Firestore, functions: Functions): TransferRepository {
  const transfers = collection(db, 'transfers');
  const subscribe = (
    queries: Query<DocumentData>[],
    cb: (ts: Transfer[]) => void,
    onError?: (e: Error) => void,
  ) =>
    subscribeUnion(
      queries,
      (docs) => cb(docs.map((d) => transferFromDoc(d.id, d.data())).sort(newestFirst).slice(0, LIST_LIMIT)),
      onError,
    );
  return {
    async initiate({ placeId, toUserId }) {
      await callCallable(functions, 'initiateTransfer', { placeId, toUserId }, TRANSFER_INITIATE_ERRORS);
    },
    async respond(id, accept) {
      await callCallable(functions, 'respondToTransfer', { transferId: id, accept });
    },
    async revoke(id) {
      await callCallable(functions, 'revokeTransfer', { transferId: id });
    },
    subscribeIncoming(uid, cb, onError) {
      // (toUserId, status, createdAt desc) index.
      const q = query(
        transfers,
        where('toUserId', '==', uid),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(LIST_LIMIT),
      );
      return subscribe([q], cb, onError);
    },
    subscribeHistory(uid, cb, onError) {
      // One query per side, each provably the caller's own ((fromUserId|toUserId), createdAt desc).
      const side = (field: 'fromUserId' | 'toUserId') =>
        query(transfers, where(field, '==', uid), orderBy('createdAt', 'desc'), limit(LIST_LIMIT));
      return subscribe([side('fromUserId'), side('toUserId')], cb, onError);
    },
  };
}
