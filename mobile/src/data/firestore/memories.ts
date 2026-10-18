import {
  collection,
  doc,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
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
    // Task 4 implements the lifecycle below.
    async findById() { throw new Error('not implemented'); },
    subscribeForUser() { throw new Error('not implemented'); },
    subscribeDeletedForUser() { throw new Error('not implemented'); },
    async update() { throw new Error('not implemented'); },
    async attachMedia() { throw new Error('not implemented'); },
    async softDelete() { throw new Error('not implemented'); },
    async restore() { throw new Error('not implemented'); },
  };
}
