import { canRestore } from '@/domain/memoryLifecycle';
import { isMemoryVisibleTo } from '@/domain/privacy';
import type { Memory } from '@/domain/types';
import { RESTORE_EXPIRED } from '../errors';
import type { MemoryRepository } from '../types';
import { ensureTimeCommunities } from './autoCommunities';
import { emulateTagNotifications } from './notify';
import { recomputePlace } from './recompute';
import type { Store } from './store';
import { canRead } from './visibility';

const LIST_LIMIT = 50;

export function createMemoryRepository(store: Store): MemoryRepository {
  const getOrThrow = (id: string): Memory => {
    const m = store.memories.get(id);
    if (!m) throw new Error('Memory not found.');
    return m;
  };
  const changed = (placeId: string) => {
    recomputePlace(store, placeId);
    store.notify(store.memoryListeners);
    store.notify(store.placeListeners);
  };
  const subscribeUserList = (
    userId: string,
    deleted: boolean,
    cb: (memories: Memory[]) => void,
  ) => {
    const emit = () => {
      const key = (m: Memory) => (deleted ? (m.deletedAt?.getTime() ?? 0) : m.createdAt.getTime());
      cb(
        [...store.memories.values()]
          .filter((m) => m.userId === userId && m.isDeleted === deleted)
          .sort((a, b) => key(b) - key(a))
          .slice(0, LIST_LIMIT),
      );
    };
    store.memoryListeners.add(emit);
    emit();
    return () => { store.memoryListeners.delete(emit); };
  };
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
    async create(input) {
      // The rules require moderation: null on create; only reportMemory sets it.
      const memory: Memory = { ...input, moderation: null };
      store.memories.set(memory.id, memory);
      recomputePlace(store, memory.placeId);
      // onMemoryWritten on create: the time communities and the author's year membership.
      if (!memory.isDeleted && !Number.isNaN(memory.createdAt.getTime())) {
        ensureTimeCommunities(store, memory.userId, memory.createdAt);
        store.notify(store.communityListeners);
      }
      store.notify(store.memoryListeners);
      store.notify(store.placeListeners);
      emulateTagNotifications(store, memory);
    },
    async findById(id) {
      const m = store.memories.get(id);
      if (!m) return null;
      const viewerId = store.session?.userId ?? null;
      if (viewerId === null) return null;
      return canRead(store, m, viewerId) ? m : null;
    },
    subscribeForUser(userId, cb) {
      return subscribeUserList(userId, false, cb);
    },
    subscribeDeletedForUser(userId, cb) {
      return subscribeUserList(userId, true, cb);
    },
    async update(id, patch, updatedAt) {
      const m = getOrThrow(id);
      store.memories.set(id, { ...m, ...patch, updatedAt });
      changed(m.placeId);
    },
    async attachMedia(id, media, updatedAt) {
      const m = getOrThrow(id);
      store.memories.set(id, {
        ...m,
        imageUrl: media.imageUrl ?? m.imageUrl,
        audioUrl: media.audioUrl ?? m.audioUrl,
        updatedAt,
      });
      changed(m.placeId);
    },
    async softDelete(id, at) {
      const m = getOrThrow(id);
      store.memories.set(id, { ...m, isDeleted: true, deletedAt: at, updatedAt: at });
      changed(m.placeId);
    },
    async restore(id, at) {
      const m = getOrThrow(id);
      if (!canRestore(m, store.now())) throw new Error(RESTORE_EXPIRED);
      store.memories.set(id, { ...m, isDeleted: false, deletedAt: null, updatedAt: at });
      changed(m.placeId);
    },
  };
}
