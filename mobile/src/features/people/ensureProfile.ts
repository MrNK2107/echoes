import { useEffect } from 'react';

import { CUSTODIAN_FALLBACK_NAME, validateDisplayName } from '@/domain/profiles';
import type { AuthSession } from '@/domain/types';
import type { Services } from '@/services/services';
import { useServices } from '@/services/ServicesProvider';

const MAX = 40;

/**
 * The first candidate that is a valid name once trimmed, spaces collapsed and cut to 40
 * characters; otherwise CUSTODIAN_FALLBACK_NAME. Never derived from the email, which is private.
 */
export function fallbackDisplayName(candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    if (!c) continue;
    const name = [...c.trim().replace(/\s+/g, ' ')].slice(0, MAX).join('').trim();
    if (validateDisplayName(name) === null) return name;
  }
  return CUSTODIAN_FALLBACK_NAME;
}

/**
 * Accounts made before Plan 3, or whose registration stopped before the profile write, have no
 * publicProfiles doc, so nobody can find or name them. Creates it from the users doc name or the
 * session name, else CUSTODIAN_FALLBACK_NAME; an existing profile is never touched. Never
 * throws: a failure is retried at the next session start.
 */
export async function ensurePublicProfile(services: Services, session: AuthSession): Promise<void> {
  const { repos, now } = services;
  try {
    if ((await repos.profiles.get(session.userId)) !== null) return;
    const user = await repos.users.get(session.userId).catch(() => null);
    const name = fallbackDisplayName([user?.displayName, session.displayName]);
    await repos.profiles.setDisplayName(session.userId, name, now());
  } catch (e) {
    console.warn('Could not repair the public profile', e);
  }
}

/** Runs ensurePublicProfile once per signed-in user. */
export function useEnsurePublicProfile(session: AuthSession | null): void {
  const services = useServices();
  const uid = session?.userId ?? null;
  useEffect(() => {
    if (!uid || !session) return;
    void ensurePublicProfile(services, session);
    // Only a new user id triggers a check; name changes within a session do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, uid]);
}
