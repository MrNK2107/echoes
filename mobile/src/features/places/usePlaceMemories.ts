import { useEffect, useState } from 'react';

import type { Memory, Place } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { useServices } from '@/services/ServicesProvider';

export type PlaceMemoriesState = {
  status: 'loading' | 'notFound' | 'ready' | 'error';
  place: Place | null;
  memories: Memory[];
};

const LOADING: PlaceMemoriesState = { status: 'loading', place: null, memories: [] };

type Keyed = PlaceMemoriesState & { key: string };

export function usePlaceMemories(placeId: string): PlaceMemoriesState {
  const { repos, now } = useServices();
  const { session } = useSession();
  const viewerId = session?.userId ?? null;
  const [state, setState] = useState<Keyed>({ ...LOADING, key: '' });

  useEffect(() => {
    if (!viewerId) return;
    const key = `${viewerId}:${placeId}`;
    let active = true;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      try {
        const [place, user] = await Promise.all([repos.places.findById(placeId), repos.users.get(viewerId)]);
        if (!active) return;
        if (!place) {
          setState({ key, status: 'notFound', place: null, memories: [] });
          return;
        }
        unsubscribe = repos.memories.subscribeVisibleForPlace(
          { placeId, viewerId, viewerCommunityIds: user?.communityIds ?? [], now: now() },
          (memories) => {
            if (active) setState({ key, status: 'ready', place, memories });
          },
          () => {
            if (active) setState({ key, status: 'error', place, memories: [] });
          },
        );
      } catch {
        if (active) setState({ key, status: 'error', place: null, memories: [] });
      }
    })();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [repos, now, placeId, viewerId]);

  // State from a previous place/viewer counts as loading until the new load lands.
  return state.key === `${viewerId}:${placeId}` ? state : LOADING;
}
