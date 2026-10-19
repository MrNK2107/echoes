import { useEffect, useMemo, useState } from 'react';

import { mapArScene, type ArScenePlace } from '@/domain/arScene';
import { distanceMeters } from '@/domain/geo';
import type { Memory } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { useNearbyPlaces, type NearbyStatus } from '@/features/map/useNearbyPlaces';
import { useBlocksState, withoutBlocked } from '@/features/safety/useBlocks';
import { useServices } from '@/services/ServicesProvider';

import { useHeading } from './useHeading';

export const AR_RADIUS_METERS = 1000;
export const AR_MAX_PLACES = 5;
export const AR_MAX_ORBS = 8;

export interface ArOrb {
  id: string;
  text: string;
  media: 'photo' | 'voice note' | null;
}

export type ArPlace = ArScenePlace & { name: string; color: string; memoryIds: string[]; orbs: ArOrb[] };

export interface ArSceneState {
  status: NearbyStatus;
  places: ArPlace[];
  heading: number;
  headingUnavailable: boolean;
  /** True once a real compass sample has arrived. */
  headingReady: boolean;
  retry(): void;
}

const NONE: Record<string, Memory[]> = {};

function addPlace(
  prev: { key: string; byPlace: Record<string, Memory[]> },
  key: string,
  placeId: string,
  memories: Memory[],
) {
  return { key, byPlace: { ...(prev.key === key ? prev.byPlace : NONE), [placeId]: memories } };
}

/**
 * Places within 1 km (nearest 5) with up to 8 visible memories each. One memory subscription per
 * place (at most 5), re-created only when the set of place ids changes; heading changes never
 * touch the data. Orbs stay empty until the block list is known (ADR-0008, fail closed).
 */
export function useArScene(): ArSceneState {
  const { repos, now } = useServices();
  const { session } = useSession();
  const viewerId = session?.userId ?? null;
  const { status, center, places: nearby, retry } = useNearbyPlaces({ once: true });
  const { heading, unavailable, ready: headingReady } = useHeading();
  const blocks = useBlocksState();
  const [loaded, setLoaded] = useState<{ key: string; byPlace: Record<string, Memory[]> }>({ key: '', byPlace: {} });

  const scene = useMemo(() => {
    if (!center) return [];
    const near = nearby.filter((p) => distanceMeters(center, p) <= AR_RADIUS_METERS);
    return mapArScene(center, near, { maxPlaces: AR_MAX_PLACES, maxOrbsPerPlace: AR_MAX_ORBS }).map((s) => ({
      scene: s,
      place: near.find((p) => p.id === s.placeId)!,
    }));
  }, [center, nearby]);

  const placeKey = scene.map((s) => s.scene.placeId).join(',');

  useEffect(() => {
    if (!viewerId || !placeKey) return;
    const ids = placeKey.split(',');
    let active = true;
    const offs: (() => void)[] = [];
    (async () => {
      try {
        const user = await repos.users.get(viewerId);
        if (!active) return;
        for (const placeId of ids) {
          offs.push(
            repos.memories.subscribeVisibleForPlace(
              { placeId, viewerId, viewerCommunityIds: user?.communityIds ?? [], now: now() },
              (memories) => {
                if (active) setLoaded((prev) => addPlace(prev, placeKey, placeId, memories));
              },
              () => {
                if (active) setLoaded((prev) => addPlace(prev, placeKey, placeId, []));
              },
            ),
          );
        }
      } catch {
        // Orbs are decoration; the places still render without them.
      }
    })();
    return () => {
      active = false;
      offs.forEach((off) => off());
    };
  }, [repos, now, viewerId, placeKey]);

  // Memories loaded for a previous set of places do not count for this one.
  const memoriesByPlace = loaded.key === placeKey ? loaded.byPlace : NONE;

  const places = useMemo<ArPlace[]>(
    () =>
      scene.map(({ scene: s, place }) => {
        const visible = blocks.ready ? withoutBlocked(memoriesByPlace[s.placeId] ?? [], blocks.blocked) : [];
        const orbs = visible
          // The author's own moderated (hidden) memories stay listable to them but never become orbs.
          .filter((m) => m.moderation !== 'hidden')
          .slice(0, AR_MAX_ORBS).map((m) => ({
          id: m.id,
          text: m.textContent,
          media: m.imageUrl ? ('photo' as const) : m.audioUrl ? ('voice note' as const) : null,
        }));
        return { ...s, name: place.name, color: place.aura.colorHex, memoryIds: orbs.map((o) => o.id), orbs };
      }),
    [scene, memoriesByPlace, blocks.ready, blocks.blocked],
  );

  return { status, places, heading, headingUnavailable: unavailable, headingReady, retry };
}
