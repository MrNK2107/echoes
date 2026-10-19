import { useEffect, useMemo, useState } from 'react';

import type { ProfileRepository } from '@/data/types';
import { useServices } from '@/services/ServicesProvider';

/** uid → display name, or null for a uid without a public profile. */
type NameCache = Map<string, string | null>;

/**
 * One cache per profile repository, i.e. per app run (the session cache). Display names are
 * public, so the cache is shared across sign-ins; a rename updates it through rememberName.
 */
const caches = new WeakMap<ProfileRepository, NameCache>();
/** Lookups in flight, so components asking for the same ids at once share one getMany. */
const pending = new WeakMap<ProfileRepository, Map<string, Promise<void>>>();

function cacheOf(profiles: ProfileRepository): NameCache {
  let c = caches.get(profiles);
  if (!c) {
    c = new Map();
    caches.set(profiles, c);
  }
  return c;
}

function pendingOf(profiles: ProfileRepository): Map<string, Promise<void>> {
  let p = pending.get(profiles);
  if (!p) {
    p = new Map();
    pending.set(profiles, p);
  }
  return p;
}

/** Records a name the app already knows (a picked search result, the user's own rename). */
export function rememberName(profiles: ProfileRepository, uid: string, displayName: string): void {
  cacheOf(profiles).set(uid, displayName);
}

/** Fetches the uncached ids in one getMany; failures are not cached, so a later render retries. */
function load(profiles: ProfileRepository, ids: string[]): Promise<void> {
  const cache = cacheOf(profiles);
  const inFlight = pendingOf(profiles);
  const waits: Promise<void>[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    if (cache.has(id)) continue;
    const p = inFlight.get(id);
    if (p) waits.push(p);
    else missing.push(id);
  }
  if (missing.length > 0) {
    const request = profiles
      .getMany(missing)
      .then((found) => {
        for (const id of missing) cache.set(id, found.get(id)?.displayName ?? null);
      })
      .catch((e: unknown) => console.warn('Could not load display names', e))
      .finally(() => {
        for (const id of missing) inFlight.delete(id);
      });
    for (const id of missing) inFlight.set(id, request);
    waits.push(request);
  }
  return Promise.all(waits).then(() => undefined);
}

/**
 * Display names for the given uids, from one batched profiles.getMany. Names are cached per app
 * session (until the app restarts), so a rename elsewhere shows up after a restart; the user's own
 * rename updates the cache through rememberName.
 */
export function useAuthorNames(ids: readonly string[]): ReadonlyMap<string, string> {
  const { repos } = useServices();
  const profiles = repos.profiles;
  const key = useMemo(() => [...new Set(ids)].sort().join('\u0000'), [ids]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const unique = key === '' ? [] : key.split('\u0000');
    const cache = cacheOf(profiles);
    if (unique.every((id) => cache.has(id))) return;
    let active = true;
    void load(profiles, unique).then(() => {
      if (active) setVersion((v) => v + 1);
    });
    return () => {
      active = false;
    };
  }, [profiles, key]);

  return useMemo(() => {
    const cache = cacheOf(profiles);
    const out = new Map<string, string>();
    for (const id of key === '' ? [] : key.split('\u0000')) {
      const name = cache.get(id);
      if (name) out.set(id, name);
    }
    return out;
    // `version` re-reads the cache after a load lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, key, version]);
}
