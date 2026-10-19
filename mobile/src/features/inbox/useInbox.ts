import { useCallback, useEffect, useMemo, useState } from 'react';

import { GENERIC_ERROR } from '@/data/errors';
import type { AppNotification } from '@/data/types';
import { useSession } from '@/features/auth/useSession';
import { useServices } from '@/services/ServicesProvider';

export interface Inbox {
  /** Newest first, at most 50. */
  items: AppNotification[];
  loaded: boolean;
  /** True when the live list could not be loaded. */
  loadFailed: boolean;
  unread: number;
  error: string | null;
  /** Marks one read; resolves false when saving fails (silently: the row stays unread, no error is set). */
  markRead: (id: string) => Promise<boolean>;
  markAllRead: () => Promise<void>;
}

/** The signed-in user's notifications, live. Empty while signed out. */
export function useInbox(): Inbox {
  const { repos, now } = useServices();
  const { session } = useSession();
  const uid = session?.userId ?? null;
  const [state, setState] = useState<{ uid: string | null; items: AppNotification[] }>({ uid: null, items: [] });
  const [error, setError] = useState<string | null>(null);
  const [failedUid, setFailedUid] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    return repos.notifications.subscribe(
      uid,
      (items) => setState({ uid, items }),
      (e) => {
        console.warn('Could not load notifications', e);
        setFailedUid(uid);
      },
    );
  }, [repos.notifications, uid]);

  const items = useMemo(() => (state.uid === uid ? state.items : []), [state, uid]);
  const unread = useMemo(() => items.filter((n) => n.readAt === null).length, [items]);

  const markRead = useCallback(
    async (id: string) => {
      if (!uid) return false;
      try {
        await repos.notifications.markRead(uid, id, now());
        return true;
      } catch {
        return false;
      }
    },
    [repos.notifications, uid, now],
  );

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    setError(null);
    try {
      await repos.notifications.markAllRead(uid, now());
    } catch {
      setError(GENERIC_ERROR);
    }
  }, [repos.notifications, uid, now]);

  return { items, loaded: !!uid && state.uid === uid, loadFailed: failedUid === uid, unread, error, markRead, markAllRead };
}
