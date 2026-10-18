import type { Transfer } from '@/domain/types';
import { callableFailure, TRANSFER_INITIATE_ERRORS } from '../callableErrors';
import type { TransferRepository } from '../types';
import { callerId, rateLimit, runCallable, validId } from './callable';
import { emulateNotify, type NotifyInput } from './notify';
import type { Store, StoredTransfer } from './store';

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 7 * DAY_MS;
const LIST_LIMIT = 50;

const toTransfer = ({ recipientWasCustodian: _r, revokedAt: _v, ...t }: StoredTransfer): Transfer => t;
const newestFirst = (a: Transfer, b: Transfer) =>
  b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1);

/**
 * functions/transfers.js expireStale, the daily job: pending transfers created more than 7 days
 * ago become expired. Demo mode has no scheduler, so it runs before every transfer read or call.
 */
function expireStale(store: Store): void {
  const cutoff = store.now().getTime() - WINDOW_MS;
  for (const [id, t] of store.transfers) {
    if (t.status === 'pending' && t.createdAt.getTime() < cutoff) store.transfers.set(id, { ...t, status: 'expired' });
  }
}

/**
 * In-process emulation of initiateTransfer / respondToTransfer / revokeTransfer (ADR-0007), with
 * the server's checks in the server's order. Custodians are additive; at most one pending
 * transfer per (place, recipient).
 */
export function createTransferRepository(store: Store): TransferRepository {
  const placeName = (placeId: string) => store.places.get(placeId)?.name ?? 'a place';
  const setCustodians = (placeId: string, update: (ids: string[]) => string[]) => {
    const place = store.places.get(placeId);
    if (!place) return;
    store.places.set(placeId, { ...place, custodianIds: update(place.custodianIds), updatedAt: store.now() });
  };
  const notify = (input: NotifyInput) => {
    if (emulateNotify(store, input)) store.notify(store.notificationListeners);
  };
  const changed = () => {
    store.notify(store.transferListeners);
    store.notify(store.placeListeners);
  };
  const pastWindow = (t: StoredTransfer) => store.now().getTime() > t.revokeUntil.getTime();
  const subscribe = (filter: (t: StoredTransfer) => boolean, cb: (ts: Transfer[]) => void) => {
    const emit = () => {
      expireStale(store);
      cb([...store.transfers.values()].filter(filter).map(toTransfer).sort(newestFirst).slice(0, LIST_LIMIT));
    };
    store.transferListeners.add(emit);
    emit();
    return () => { store.transferListeners.delete(emit); };
  };

  return {
    initiate(input) {
      return runCallable(() => {
        const uid = callerId(store);
        const placeId = validId(input.placeId);
        const toUserId = validId(input.toUserId);
        rateLimit(store, uid, 'initiateTransfer', 20);
        expireStale(store);
        if (toUserId === uid) throw callableFailure('invalid-argument');
        if (store.isBlocked(uid, toUserId)) throw callableFailure('permission-denied');
        const place = store.places.get(placeId);
        if (!place) throw callableFailure('not-found');
        if (!place.custodianIds.includes(uid)) throw callableFailure('permission-denied');
        if (!store.profiles.has(toUserId)) throw callableFailure('not-found');
        if (place.custodianIds.includes(toUserId)) throw callableFailure('failed-precondition');
        const pending = [...store.transfers.values()].some(
          (t) => t.placeId === placeId && t.toUserId === toUserId && t.status === 'pending',
        );
        if (pending) throw callableFailure('already-exists');
        const now = store.now();
        const id = store.nextId('transfer');
        store.transfers.set(id, {
          id, placeId, fromUserId: uid, toUserId, status: 'pending', createdAt: now, respondedAt: null,
          revokeUntil: new Date(now.getTime() + WINDOW_MS), recipientWasCustodian: null, revokedAt: null,
        });
        changed();
        notify({
          to: toUserId, type: 'transferRequest', actorId: uid, params: { place: place.name },
          data: { transferId: id, placeId }, id: `transferRequest_${id}`,
        });
      }, TRANSFER_INITIATE_ERRORS);
    },
    respond(id, accept) {
      return runCallable(() => {
        const uid = callerId(store);
        validId(id);
        if (typeof accept !== 'boolean') throw callableFailure('invalid-argument');
        expireStale(store);
        const status = accept ? 'accepted' : 'rejected';
        const t = store.transfers.get(id);
        if (!t) throw callableFailure('not-found');
        if (t.toUserId !== uid) throw callableFailure('permission-denied');
        if (t.status === status) return; // repeating the same answer is a no-op
        if (t.status !== 'pending' || pastWindow(t)) throw callableFailure('failed-precondition');
        const now = store.now();
        if (accept) {
          if (store.isBlocked(uid, t.fromUserId)) throw callableFailure('permission-denied');
          const place = store.places.get(t.placeId);
          if (!place) throw callableFailure('failed-precondition');
          // The sender must still look after the place (e.g. their own transfer was revoked).
          if (!place.custodianIds.includes(t.fromUserId)) throw callableFailure('failed-precondition');
          const recipientWasCustodian = place.custodianIds.includes(uid);
          setCustodians(t.placeId, (ids) => (ids.includes(uid) ? ids : [...ids, uid]));
          store.transfers.set(id, { ...t, status, respondedAt: now, recipientWasCustodian });
        } else {
          store.transfers.set(id, { ...t, status, respondedAt: now });
        }
        changed();
        const type = accept ? 'transferAccepted' : 'transferRejected';
        notify({
          to: t.fromUserId, type, actorId: uid, params: { place: placeName(t.placeId) },
          data: { transferId: id, placeId: t.placeId }, id: `${type}_${id}`,
        });
      });
    },
    revoke(id) {
      return runCallable(() => {
        const uid = callerId(store);
        validId(id);
        expireStale(store);
        const t = store.transfers.get(id);
        if (!t) throw callableFailure('not-found');
        if (t.fromUserId !== uid) throw callableFailure('permission-denied');
        if (t.status === 'revoked') return;
        if (t.status !== 'pending' && t.status !== 'accepted') throw callableFailure('failed-precondition');
        if (pastWindow(t)) throw callableFailure('failed-precondition');
        const now = store.now();
        if (t.status === 'accepted' && t.recipientWasCustodian !== true) {
          setCustodians(t.placeId, (ids) => ids.filter((c) => c !== t.toUserId));
          // The recipient's own pending requests for the place go with their custodianship.
          for (const [otherId, other] of store.transfers) {
            if (other.fromUserId === t.toUserId && other.placeId === t.placeId && other.status === 'pending') {
              store.transfers.set(otherId, { ...other, status: 'revoked', revokedAt: now });
            }
          }
        }
        store.transfers.set(id, { ...t, status: 'revoked', revokedAt: now });
        changed();
      });
    },
    subscribeIncoming(uid, cb) {
      return subscribe((t) => t.toUserId === uid && t.status === 'pending', cb);
    },
    subscribeHistory(uid, cb) {
      return subscribe((t) => t.fromUserId === uid || t.toUserId === uid, cb);
    },
  };
}
