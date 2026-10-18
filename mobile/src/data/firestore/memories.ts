import {
  collection,
  doc,
  getDoc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
import { normalizePrivacyFields } from '@/domain/memoryLifecycle';
import type { Memory } from '@/domain/types';
import { memoryFromDoc, memoryToDoc } from '../mappers';
import type { MemoryRepository } from '../types';
import { subscribeUnion } from './snapshots';

const LIST_LIMIT = 50;
/**
 * Community ids per `in` query. Each value costs one `exists()` document access in the rules,
 * and production rules allow at most 10 per request.
 */
export const COMMUNITY_IN_CHUNK = 10;
/**
 * The rules compare `releaseDate <= request.time` (server clock). Bounding the query a little
 * below the client clock keeps a fast device clock from getting the branch denied; memories
 * released in the last few minutes simply appear a little later.
 */
export const TIME_RELEASE_SKEW_MS = 5 * 60 * 1000;

export function timeReleaseBound(now: Date, clientNow: number = Date.now()): Date {
  return new Date(Math.min(now.getTime(), clientNow) - TIME_RELEASE_SKEW_MS);
}

export const RESTORE_EXPIRED = 'This memory can no longer be restored.';

function errorCode(e: unknown): unknown {
  return typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
}

const isPermissionDenied = (e: unknown) => errorCode(e) === 'permission-denied';

/** Newest first; the query already orders, this keeps the order explicit after the union. */
function newestFirst(ms: Memory[], key: (m: Memory) => Date | null): Memory[] {
  const t = (m: Memory) => key(m)?.getTime() ?? 0;
  return ms.sort((a, b) => t(b) - t(a)).slice(0, LIST_LIMIT);
}

/**
 * Soft-delete stamps are server timestamps (ruling R13). Until the write is acknowledged the local
 * value is pending, so it is read as the SDK's estimate; otherwise a fresh delete would map with
 * `deletedAt: null` and drop out of Recently deleted.
 */
function fromSnapshot(d: DocumentSnapshot<DocumentData>): Memory | null {
  const data = d.data({ serverTimestamps: 'estimate' });
  return data === undefined ? null : memoryFromDoc(d.id, data);
}

function mapSnapshots(docs: DocumentSnapshot<DocumentData>[]): Memory[] {
  return docs.map(fromSnapshot).filter((m): m is Memory => m !== null);
}

function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

export function createMemoryRepository(db: Firestore): MemoryRepository {
  const memories = collection(db, 'memories');
  return {
    subscribeVisibleForPlace(q, cb, onError) {
      // Each query carries exactly the constraints `isVisibleMemory` in firestore.rules needs to
      // prove every result readable; a `list` that cannot be proven is rejected wholesale, and
      // subscribeUnion then drops only that branch.
      const visible = (...constraints: QueryConstraint[]) =>
        query(
          memories,
          where('placeId', '==', q.placeId),
          where('isDeleted', '==', false),
          ...constraints,
          orderBy('createdAt', 'desc'),
          limit(LIST_LIMIT),
        );
      const queries = [
        visible(where('privacy', '==', 'public')),
        visible(where('userId', '==', q.viewerId)),
        visible(where('privacy', '==', 'tagged'), where('taggedUserIds', 'array-contains', q.viewerId)),
        visible(
          where('privacy', '==', 'timeRelease'),
          where('releaseDate', '<=', Timestamp.fromDate(timeReleaseBound(q.now))),
        ),
        ...chunk(q.viewerCommunityIds, COMMUNITY_IN_CHUNK).map((ids) =>
          visible(where('privacy', '==', 'community'), where('communityId', 'in', ids)),
        ),
      ];
      return subscribeUnion(
        queries,
        (docs) =>
          cb(
            docs
              .map((d) => memoryFromDoc(d.id, d.data()))
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .slice(0, LIST_LIMIT),
          ),
        onError,
      );
    },
    async create(memory) {
      await setDoc(doc(db, 'memories', memory.id), memoryToDoc(memory));
    },
    async findById(id) {
      // The rules allow `get` for visible memories and for the author's own (deleted or not).
      // Anything else, including a missing document, is denied, which reads as "not found".
      try {
        return fromSnapshot(await getDoc(doc(db, 'memories', id)));
      } catch (e) {
        const code = errorCode(e);
        if (code === 'permission-denied' || code === 'not-found') return null;
        throw e;
      }
    },
    subscribeForUser(userId, cb, onError) {
      // `userId ==` lets the rules prove every result is the caller's own memory.
      const q = query(
        memories,
        where('userId', '==', userId),
        where('isDeleted', '==', false),
        orderBy('createdAt', 'desc'),
        limit(LIST_LIMIT),
      );
      return subscribeUnion(
        [q],
        (docs) => cb(newestFirst(mapSnapshots(docs), (m) => m.createdAt)),
        onError,
      );
    },
    subscribeDeletedForUser(userId, cb, onError) {
      const q = query(
        memories,
        where('userId', '==', userId),
        where('isDeleted', '==', true),
        orderBy('deletedAt', 'desc'),
        limit(LIST_LIMIT),
      );
      return subscribeUnion(
        [q],
        (docs) => cb(newestFirst(mapSnapshots(docs), (m) => m.deletedAt)),
        onError,
      );
    },
    async update(id, patch, updatedAt) {
      // Only fields in the rules' `mutableMemoryEditOnly` list; `affectedKeys` rejects any other.
      const privacy = normalizePrivacyFields(patch);
      await updateDoc(doc(db, 'memories', id), {
        textContent: patch.textContent,
        sentiment: {
          compound: patch.sentiment.compound,
          positive: patch.sentiment.positive,
          neutral: patch.sentiment.neutral,
          negative: patch.sentiment.negative,
        },
        privacy: privacy.privacy,
        taggedUserIds: privacy.taggedUserIds,
        communityId: privacy.communityId,
        releaseDate: privacy.releaseDate === null ? null : Timestamp.fromDate(privacy.releaseDate),
        updatedAt: Timestamp.fromDate(updatedAt),
      });
    },
    async attachMedia(id, media, updatedAt) {
      const fields: DocumentData = { updatedAt: Timestamp.fromDate(updatedAt) };
      if (media.imageUrl !== undefined) fields.imageUrl = media.imageUrl;
      if (media.audioUrl !== undefined) fields.audioUrl = media.audioUrl;
      await updateDoc(doc(db, 'memories', id), fields);
    },
    // `at` is honoured only by the in-memory backend: the rules require both stamps to equal
    // `request.time` (ruling R13), so the client clock never decides when a memory was deleted.
    async softDelete(id) {
      await updateDoc(doc(db, 'memories', id), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    async restore(id) {
      // `restoreOnly` judges the 30-day window against the server clock (`request.time`); the
      // author meets every other condition, so a denial here means the window has closed.
      try {
        await updateDoc(doc(db, 'memories', id), {
          isDeleted: false,
          deletedAt: null,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        if (isPermissionDenied(e)) throw new Error(RESTORE_EXPIRED);
        throw e;
      }
    },
  };
}
