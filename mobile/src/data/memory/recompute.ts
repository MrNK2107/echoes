import { calculateAura } from '@/domain/aura';
import { GEO_THRESHOLD } from '@/domain/communities';
import { ensureGeoCommunity } from './autoCommunities';
import type { Store } from './store';

/**
 * onMemoryWritten's per-place work: recomputes the aura and counts from live (not deleted)
 * memories, appends an aura history entry, and ensures the geo community once the place is busy.
 * Callers notify listeners.
 */
export function recomputePlace(store: Store, placeId: string): void {
  const place = store.places.get(placeId);
  if (!place) return;
  const now = store.now();
  const live = [...store.memories.values()].filter((m) => m.placeId === placeId && !m.isDeleted);
  const livePublic = live.filter((m) => m.privacy === 'public');
  const aura = calculateAura(livePublic, now);
  store.places.set(placeId, {
    ...place,
    aura,
    memoryCount: live.length,
    publicMemoryCount: livePublic.length,
    updatedAt: now,
  });
  const history = store.auraHistory.get(placeId) ?? [];
  history.push({ id: store.nextId('aura'), aura, recordedAt: now });
  store.auraHistory.set(placeId, history);
  if (livePublic.length >= GEO_THRESHOLD) {
    ensureGeoCommunity(store, placeId);
    store.notify(store.communityListeners);
  }
}
