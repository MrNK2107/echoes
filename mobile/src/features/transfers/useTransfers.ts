import { useEffect, useMemo, useState } from 'react';

import type { Place, Transfer } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { useServices } from '@/services/ServicesProvider';

export type Live<T> = { loaded: boolean; error: boolean; items: T[] };

const EMPTY: Live<never> = { loaded: false, error: false, items: [] };

/**
 * Keys a live list by the signed-in uid, so a previous user's list never shows. `subscribe` must
 * be stable per repository.
 */
function useLive<T>(
  subscribe: ((uid: string, cb: (items: T[]) => void, onError: (e: Error) => void) => () => void) | null,
  label: string,
): Live<T> {
  const { session } = useSession();
  const uid = session?.userId ?? null;
  const [state, setState] = useState<Live<T> & { uid: string | null }>({ ...EMPTY, uid: null });

  useEffect(() => {
    if (!uid || !subscribe) return;
    return subscribe(
      uid,
      (items) => setState({ uid, loaded: true, error: false, items }),
      (e) => {
        console.warn(`Could not load ${label}`, e);
        setState((s) => (s.uid === uid && s.loaded ? s : { ...EMPTY, uid, error: true }));
      },
    );
  }, [subscribe, uid, label]);

  return state.uid === uid ? state : EMPTY;
}

/** Transfers the signed-in user sent or received, newest first. */
export function useTransferHistory(): Live<Transfer> {
  const { repos } = useServices();
  const transfers = repos.transfers;
  const subscribe = useMemo(() => transfers.subscribeHistory.bind(transfers), [transfers]);
  return useLive(subscribe, 'transfer history');
}

/** Pending requests to the signed-in user. */
export function useIncomingTransfers(): Live<Transfer> {
  const { repos } = useServices();
  const transfers = repos.transfers;
  const subscribe = useMemo(() => transfers.subscribeIncoming.bind(transfers), [transfers]);
  return useLive(subscribe, 'custodianship requests');
}

/** Places the signed-in user looks after, by name. */
export function useCustodianPlaces(): Live<Place> {
  const { repos } = useServices();
  const places = repos.places;
  const subscribe = useMemo(() => places.subscribeCustodianOf.bind(places), [places]);
  return useLive(subscribe, 'places you look after');
}

/** placeId → name for the given ids; ids that fail to load or no longer exist are absent. */
export function usePlaceNames(ids: readonly string[]): ReadonlyMap<string, string> {
  const { repos } = useServices();
  const key = useMemo(() => [...new Set(ids)].sort().join('\u0000'), [ids]);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    const missing = (key === '' ? [] : key.split('\u0000')).filter((id) => !names.has(id));
    if (missing.length === 0) return;
    let active = true;
    void Promise.all(
      missing.map((id) =>
        repos.places.findById(id).catch((e: unknown) => {
          console.warn('Could not load a place name', e);
          return null;
        }),
      ),
    ).then((found) => {
      if (!active) return;
      setNames((prev) => {
        const next = new Map(prev);
        for (const p of found) if (p) next.set(p.id, p.name);
        return next;
      });
    });
    return () => {
      active = false;
    };
    // `names` is read only to skip known ids; adding it would refetch after every load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos.places, key]);

  return names;
}
