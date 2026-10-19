import { useContext } from 'react';

import { BlocksContext, type BlocksContextValue, type BlocksState } from './BlocksProvider';

export type { BlocksState };

/**
 * The signed-in user's block list, live (ADR-0008: the client hides blocked users' memories
 * everywhere), from the shared BlocksProvider. Screens that show other people's memories must wait
 * for `ready`, so nothing by a blocked person renders before the list is known. An error before the
 * first snapshot leaves it not ready (with `error`); a later error keeps the last known list.
 */
export function useBlocksState(): BlocksContextValue {
  const state = useContext(BlocksContext);
  if (!state) throw new Error('useBlocksState must be used inside a BlocksProvider');
  return state;
}

/** The blocked uids, empty until loaded: for filters where a late update is acceptable (search, own lists). */
export function useBlocks(): ReadonlySet<string> {
  return useBlocksState().blocked;
}

/** Drops items whose author is blocked; returns the same array when nothing is blocked. */
export function withoutBlocked<T extends { userId: string }>(items: T[], blocked: ReadonlySet<string>): T[] {
  return blocked.size === 0 ? items : items.filter((m) => !blocked.has(m.userId));
}
