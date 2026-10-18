import { calculateAura } from '@/domain/aura';
import { isMemoryVisibleTo } from '@/domain/privacy';
import type { Memory } from '@/domain/types';
import type { MemoryRepository } from '../types';
import type { Store } from './store';

const LIST_LIMIT = 50;

function recomputePlace(store: Store, placeId: string): void {
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

export function createMemoryRepository(store: Store): MemoryRepository {
  return {
    subscribeVisibleForPlace(q, cb) {
      const emit = () => {
        const visible = [...store.memories.values()]
          .filter(
            (m: Memory) =>
              m.placeId === q.placeId &&
              isMemoryVisibleTo(m, {
                viewerId: q.viewerId,
                viewerIsCommunityMember: m.communityId !== null && q.viewerCommunityIds.includes(m.communityId),
                now: q.now,
              }),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, LIST_LIMIT);
        cb(visible);
      };
      store.memoryListeners.add(emit);
      emit();
      return () => { store.memoryListeners.delete(emit); };
    },
    async create(memory) {
      store.memories.set(memory.id, memory);
      recomputePlace(store, memory.placeId);
      store.notify(store.memoryListeners);
      store.notify(store.placeListeners);
    },
  };
}
