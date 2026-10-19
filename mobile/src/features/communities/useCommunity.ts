import { useEffect, useState } from 'react';

import type { Community, CommunityMembership, Memory } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { useServices } from '@/services/ServicesProvider';

export type CommunityState = {
  status: 'loading' | 'notFound' | 'ready' | 'error';
  community: Community | null;
  /** undefined until the first membership snapshot. */
  membership: CommunityMembership | null | undefined;
  feed: { status: 'loading' | 'ready' | 'error'; memories: Memory[] };
};

type Keyed<T> = { key: string; value: T };

/**
 * The community (re-read whenever the membership changes, so the member count follows a join or
 * leave), the viewer's membership, and the feed. The feed waits for the membership: members get
 * the member branch (viewerCommunityIds), non-members only their own memories shared with it.
 */
export function useCommunity(id: string): CommunityState {
  const { repos, now } = useServices();
  const { session } = useSession();
  const uid = session?.userId ?? null;
  const key = `${uid ?? ''}:${id}`;

  const [membership, setMembership] = useState<Keyed<CommunityMembership | null> | null>(null);
  const [community, setCommunity] = useState<Keyed<{ status: CommunityState['status']; community: Community | null }> | null>(
    null,
  );
  const [feed, setFeed] = useState<Keyed<CommunityState['feed']> | null>(null);

  useEffect(() => {
    if (!uid) return;
    return repos.communities.subscribeMembership(
      id,
      uid,
      (m) => setMembership({ key, value: m }),
      (e) => {
        console.warn('Could not load membership', e);
        setMembership({ key, value: null });
      },
    );
  }, [repos.communities, id, uid, key]);

  const memberKey = membership?.key === key ? (membership.value?.role ?? 'none') : null;

  useEffect(() => {
    if (!uid) return;
    let active = true;
    repos.communities
      .findById(id)
      .then((c) => {
        if (active) setCommunity({ key, value: { status: c ? 'ready' : 'notFound', community: c } });
      })
      .catch((e: unknown) => {
        console.warn('Could not load community', e);
        if (active) setCommunity((prev) => (prev?.key === key && prev.value.community ? prev : { key, value: { status: 'error', community: null } }));
      });
    return () => {
      active = false;
    };
    // memberKey re-reads the community after a join or leave.
  }, [repos.communities, id, uid, key, memberKey]);

  useEffect(() => {
    if (!uid || memberKey === null) return;
    const feedKey = `${key}:${memberKey}`;
    return repos.communities.subscribeFeed(
      id,
      { viewerId: uid, viewerCommunityIds: memberKey === 'none' ? [] : [id], now: now() },
      (memories) => setFeed({ key: feedKey, value: { status: 'ready', memories } }),
      (e) => {
        console.warn('Could not load community feed', e);
        setFeed({ key: feedKey, value: { status: 'error', memories: [] } });
      },
    );
  }, [repos.communities, now, id, uid, key, memberKey]);

  const current = community?.key === key ? community.value : null;
  const currentFeed = feed && memberKey !== null && feed.key === `${key}:${memberKey}` ? feed.value : null;
  return {
    status: current?.status ?? 'loading',
    community: current?.community ?? null,
    membership: membership?.key === key ? membership.value : undefined,
    feed: currentFeed ?? { status: 'loading', memories: [] },
  };
}
