import { calculateAura } from '@/domain/aura';
import type { Store } from './store';

/** Recomputes a place's aura and counts from its live (not deleted) memories. */
export function recomputePlace(store: Store, placeId: string): void {
  const place = store.places.get(placeId);
  if (!place) return;
  const now = store.now();
  const live = [...store.memories.values()].filter((m) => m.placeId === placeId && !m.isDeleted);
  const livePublic = live.filter((m) => m.privacy === 'public');
  store.places.set(placeId, {
    ...place,
    aura: calculateAura(livePublic, now),
    memoryCount: live.length,
    publicMemoryCount: livePublic.length,
    updatedAt: now,
  });
}
