import { useEffect, useState } from 'react';

import { useSession } from '@/features/auth/useSession';
import { useServices } from '@/services/ServicesProvider';

const NONE: ReadonlySet<string> = new Set();

export type BlocksState = {
  /** True once the first snapshot of the block list has arrived. */
  ready: boolean;
  /** The subscription failed before any snapshot; `ready` stays false. */
  error: boolean;
  blocked: ReadonlySet<string>;
};

const NOT_READY: BlocksState = { ready: false, error: false, blocked: NONE };

/**
 * The signed-in user's block list, live (ADR-0008: the client hides blocked users' memories
 * everywhere). Screens that show other people's memories must wait for `ready`, so nothing by a
 * blocked person renders before the list is known. An error before the first snapshot leaves it
 * not ready (with `error`); a later error keeps the last known list.
 */
export function useBlocksState(): BlocksState {
  const { repos } = useServices();
  const { session } = useSession();
  const uid = session?.userId ?? null;
  const [state, setState] = useState<BlocksState & { uid: string | null }>({ ...NOT_READY, uid: null });

  useEffect(() => {
    if (!uid) return;
    return repos.safety.subscribeBlocks(
      uid,
      (ids) => setState({ uid, ready: true, error: false, blocked: new Set(ids) }),
      (e) => {
        console.warn('Could not load blocked people', e);
        setState((s) => (s.uid === uid && s.ready ? s : { ...NOT_READY, uid, error: true }));
      },
    );
  }, [repos.safety, uid]);

  if (state.uid !== uid) return NOT_READY;
  return { ready: state.ready, error: state.error, blocked: state.blocked };
}

/** The blocked uids, empty until loaded: for filters where a late update is acceptable (search, own lists). */
export function useBlocks(): ReadonlySet<string> {
  return useBlocksState().blocked;
}

/** Drops items whose author is blocked; returns the same array when nothing is blocked. */
export function withoutBlocked<T extends { userId: string }>(items: T[], blocked: ReadonlySet<string>): T[] {
  return blocked.size === 0 ? items : items.filter((m) => !blocked.has(m.userId));
}
