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
/** Firestore caps `in` disjunctions at 30 values. */
const IN_CHUNK = 30;

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
      // prove every result readable; a `list` that cannot be proven is rejected wholesale.
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
          where('releaseDate', '<=', Timestamp.fromDate(q.now)),
        ),
        ...chunk(q.viewerCommunityIds, IN_CHUNK).map((ids) =>
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
  };
}
