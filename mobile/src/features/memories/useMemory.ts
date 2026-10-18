import { useCallback, useEffect, useState } from 'react';

import type { Memory } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { useServices } from '@/services/ServicesProvider';

export type MemoryState = {
  status: 'loading' | 'notFound' | 'ready' | 'error';
  memory: Memory | null;
};

export type UseMemory = MemoryState & { reload: () => void };

const LOADING: MemoryState = { status: 'loading', memory: null };
type Keyed = MemoryState & { key: string };

/** Soft-deleted memories count as not found here; they are restored from Recently deleted. */
export function useMemory(id: string): UseMemory {
  const { repos } = useServices();
  const { session } = useSession();
  const viewerId = session?.userId ?? null;
  const [state, setState] = useState<Keyed>({ ...LOADING, key: '' });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!viewerId) return;
    const key = `${viewerId}:${id}`;
    let active = true;
    repos.memories
      .findById(id)
      .then((memory) => {
        if (!active) return;
        setState(
          memory && !memory.isDeleted ? { key, status: 'ready', memory } : { key, status: 'notFound', memory: null },
        );
      })
      .catch(() => {
        if (active) setState({ key, status: 'error', memory: null });
      });
    return () => {
      active = false;
    };
  }, [repos, id, viewerId, version]);

  return { ...(state.key === `${viewerId}:${id}` ? state : LOADING), reload };
}
