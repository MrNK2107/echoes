import { distanceMeters } from '@/domain/geo';
import type { LatLng, Place } from '@/domain/types';
import type { PlaceRepository } from '../types';
import type { Store } from './store';

const AURA_HISTORY_LIMIT = 14;
const CUSTODIAN_LIMIT = 50;

const byName = (a: Place, b: Place) => a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1);

function nearby(store: Store, q: { center: LatLng; radiusMeters: number }): Place[] {
  return [...store.places.values()]
    .map((place) => ({ place, d: distanceMeters(q.center, place) }))
    .filter((x) => x.d <= q.radiusMeters)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.place);
}

export function createPlaceRepository(store: Store): PlaceRepository {
  return {
    subscribeNearby(q, cb) {
      const emit = () => cb(nearby(store, q));
      store.placeListeners.add(emit);
      emit();
      return () => { store.placeListeners.delete(emit); };
    },
    async findById(id) {
      return store.places.get(id) ?? null;
    },
    async findNearest(q) {
      return nearby(store, q)[0] ?? null;
    },
    async create(place) {
      store.places.set(place.id, place);
      store.notify(store.placeListeners);
    },
    subscribeCustodianOf(uid, cb) {
      const emit = () =>
        cb([...store.places.values()].filter((p) => p.custodianIds.includes(uid)).sort(byName).slice(0, CUSTODIAN_LIMIT));
      store.placeListeners.add(emit);
      emit();
      return () => { store.placeListeners.delete(emit); };
    },
    subscribeAuraHistory(placeId, cb) {
      const emit = () => cb((store.auraHistory.get(placeId) ?? []).slice(-AURA_HISTORY_LIMIT));
      store.placeListeners.add(emit);
      emit();
      return () => { store.placeListeners.delete(emit); };
    },
  };
}
