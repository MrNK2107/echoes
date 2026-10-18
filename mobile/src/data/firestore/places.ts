import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { coveringPrefixes, distanceMeters, geohashRangeEnd } from '@/domain/geo';
import type { LatLng, Place } from '@/domain/types';
import { auraHistoryFromDoc, placeFromDoc, placeToDoc } from '../mappers';
import type { PlaceRepository } from '../types';
import { subscribeUnion } from './snapshots';

const CANDIDATE_LIMIT = 50;
const AURA_HISTORY_LIMIT = 14;

/** One geohash range query per covering prefix (see `coveringPrefixes` for why not just `queryPrefixes`). */
function prefixQueries(db: Firestore, q: { center: LatLng; radiusMeters: number }) {
  const places = collection(db, 'places');
  return coveringPrefixes(q.center, q.radiusMeters).map((p) =>
    query(
      places,
      where('geohash', '>=', p),
      where('geohash', '<', geohashRangeEnd(p)),
      limit(CANDIDATE_LIMIT),
    ),
  );
}

function withinRadius(
  docs: QueryDocumentSnapshot<DocumentData>[],
  q: { center: LatLng; radiusMeters: number },
): Place[] {
  const byId = new Map<string, Place>();
  for (const d of docs) byId.set(d.id, placeFromDoc(d.id, d.data()));
  return [...byId.values()]
    .map((place) => ({ place, d: distanceMeters(q.center, place) }))
    .filter((x) => x.d <= q.radiusMeters)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.place);
}

export function createPlaceRepository(db: Firestore): PlaceRepository {
  return {
    subscribeNearby(q, cb, onError) {
      return subscribeUnion(prefixQueries(db, q), (docs) => cb(withinRadius(docs, q)), onError);
    },
    async findById(id) {
      const snap = await getDoc(doc(db, 'places', id));
      const data = snap.data();
      return data === undefined ? null : placeFromDoc(snap.id, data);
    },
    async findNearest(q) {
      const snaps = await Promise.all(prefixQueries(db, q).map((pq) => getDocs(pq)));
      return withinRadius(snaps.flatMap((s) => s.docs), q)[0] ?? null;
    },
    async create(place) {
      await setDoc(doc(db, 'places', place.id), placeToDoc(place));
    },
    subscribeAuraHistory(placeId, cb, onError) {
      // Server-appended by onMemoryWritten; ISO `recordedAt` strings sort chronologically.
      const q = query(
        collection(db, 'places', placeId, 'auraHistory'),
        orderBy('recordedAt', 'desc'),
        limit(AURA_HISTORY_LIMIT),
      );
      return subscribeUnion(
        [q],
        (docs) =>
          cb(
            docs
              .map((d) => auraHistoryFromDoc(d.id, d.data()))
              .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime() || (a.id < b.id ? -1 : 1)),
          ),
        onError,
      );
    },
  };
}
