import { distanceMeters } from '@/domain/geo';
import type { LatLng, Place } from '@/domain/types';
import type { PlaceRepository } from '../types';
import type { Store } from './store';

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
  };
}
