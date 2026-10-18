import { useCallback, useEffect, useState } from 'react';

import type { LatLng, Place } from '@/domain/types';
import { useServices } from '@/services/ServicesProvider';

export const NEARBY_RADIUS_METERS = 1500;

export type NearbyStatus = 'locating' | 'denied' | 'error' | 'ready';

export function useNearbyPlaces(): {
  status: NearbyStatus;
  center: LatLng | null;
  places: Place[];
  retry(): void;
} {
  const { location, repos } = useServices();
  const [status, setStatus] = useState<NearbyStatus>('locating');
  const [center, setCenter] = useState<LatLng | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      try {
        const permission = await location.requestPermission();
        if (!active) return;
        if (permission === 'denied') {
          setStatus('denied');
          return;
        }
        const position = await location.getCurrentPosition();
        if (!active) return;
        setCenter(position);
        unsubscribe = repos.places.subscribeNearby(
          { center: position, radiusMeters: NEARBY_RADIUS_METERS },
          (next) => {
            if (!active) return;
            setPlaces(next);
            setStatus('ready');
          },
          () => {
            if (active) setStatus('error');
          },
        );
      } catch {
        if (active) setStatus('error');
      }
    })();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [location, repos, attempt]);

  const retry = useCallback(() => {
    setStatus('locating');
    setAttempt((n) => n + 1);
  }, []);
  return { status, center, places, retry };
}
