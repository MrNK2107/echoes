import { useEffect } from 'react';

import { validateDisplayName } from '@/domain/profiles';
import type { AuthSession } from '@/domain/types';
import type { Services } from '@/services/services';
import { useServices } from '@/services/ServicesProvider';

const LAST_RESORT = 'ECHOES custodian';
const MAX = 40;

/**
 * The first valid name among the candidates, else the email's local part (cut to 40 characters),
 * else `ECHOES custodian`.
 */
export function fallbackDisplayName(candidates: (string | null | undefined)[], email: string): string {
  for (const c of candidates) {
    if (c && validateDisplayName(c) === null) return c.trim();
  }
  const local = [...email.split('@')[0]!.trim()].slice(0, MAX).join('');
  return validateDisplayName(local) === null ? local : LAST_RESORT;
}

/**
 * Accounts made before Plan 3, or whose registration stopped before the profile write, have no
 * publicProfiles doc, so nobody can find or name them. Creates it from the users doc name, the
 * session name or the email. Never throws: a failure is retried at the next session start.
 */
export async function ensurePublicProfile(services: Services, session: AuthSession): Promise<void> {
  const { repos, now } = services;
  try {
    if ((await repos.profiles.get(session.userId)) !== null) return;
    const user = await repos.users.get(session.userId).catch(() => null);
    const name = fallbackDisplayName([user?.displayName, session.displayName], session.email);
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
