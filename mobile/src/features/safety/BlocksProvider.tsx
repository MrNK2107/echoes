import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

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

export type BlocksContextValue = BlocksState & {
  /** Re-subscribes after a failure. */
  retry: () => void;
};

const NOT_READY: BlocksState = { ready: false, error: false, blocked: NONE };

/** null outside the provider; `useBlocksState` turns that into a thrown error. */
export const BlocksContext = createContext<BlocksContextValue | null>(null);

/**
 * Owns the one live subscription to the signed-in user's block list (ADR-0008) and shares it with
 * every screen below, so mounting several screens never opens several listeners.
 */
export function BlocksProvider({ children }: { children: ReactNode }) {
  const { repos } = useServices();
  const { session } = useSession();
  const uid = session?.userId ?? null;
  const [state, setState] = useState<BlocksState & { uid: string | null }>({ ...NOT_READY, uid: null });

  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

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
  }, [repos.safety, uid, attempt]);

  const errored = state.uid === uid && state.error && !state.ready;
  // Coming back to the foreground is the natural moment to retry a failed first load.
  useEffect(() => {
    if (!errored) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') retry();
    });
    return () => sub.remove();
  }, [errored, retry]);

  const value = useMemo<BlocksContextValue>(
    () =>
      state.uid !== uid
        ? { ...NOT_READY, retry }
        : { ready: state.ready, error: state.error, blocked: state.blocked, retry },
    [state, uid, retry],
  );
  return <BlocksContext.Provider value={value}>{children}</BlocksContext.Provider>;
}
