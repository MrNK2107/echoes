import { useEffect, useState } from 'react';

import { useSession } from '@/features/auth/useSession';
import { useServices } from '@/services/ServicesProvider';

const NONE: ReadonlySet<string> = new Set();

/**
 * The uids the signed-in user has blocked, live (ADR-0008: the client hides blocked users'
 * memories everywhere). Empty while signed out or loading; a failed subscription keeps the last
 * known list.
 */
export function useBlocks(): ReadonlySet<string> {
  const { repos } = useServices();
  const { session } = useSession();
  const uid = session?.userId ?? null;
  const [state, setState] = useState<{ uid: string | null; blocked: ReadonlySet<string> }>({
    uid: null,
    blocked: NONE,
  });

  useEffect(() => {
    if (!uid) return;
    return repos.safety.subscribeBlocks(
      uid,
      (ids) => setState({ uid, blocked: new Set(ids) }),
      (e) => console.warn('Could not load blocked people', e),
    );
  }, [repos.safety, uid]);

  return state.uid === uid ? state.blocked : NONE;
}

/** Drops items whose author is blocked; returns the same array when nothing is blocked. */
export function withoutBlocked<T extends { userId: string }>(items: T[], blocked: ReadonlySet<string>): T[] {
  return blocked.size === 0 ? items : items.filter((m) => !blocked.has(m.userId));
}
