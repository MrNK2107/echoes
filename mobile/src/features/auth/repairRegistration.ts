import { DEFAULT_NOTIFICATION_PREFS, validateDisplayName } from '@/domain/profiles';
import type { AuthSession } from '@/domain/types';
import { ensurePublicProfile } from '@/features/people/ensureProfile';
import type { Services } from '@/services/services';

/** True when the signed-in account has no users/{uid} doc (registration stopped part-way). */
export async function needsRepair(services: Services, session: AuthSession): Promise<boolean> {
  return (await services.repos.users.get(session.userId)) === null;
}

/**
 * Finishes a partial registration: creates users/{uid} with the terms time and the defaults
 * register uses, then the public profile. Rejects with Error(DISPLAY_NAME_ERROR) for a bad name.
 */
export async function completeRegistration(
  services: Services,
  session: AuthSession,
  name: string,
  at: Date,
): Promise<void> {
  const nameError = validateDisplayName(name);
  if (nameError !== null) throw new Error(nameError);
  const displayName = name.trim();
  await services.repos.users.create({
    id: session.userId,
    displayName,
    email: session.email,
    photoUrl: null,
    defaultPrivacy: 'public',
    managedPlaceIds: [],
    communityIds: [],
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
    acceptedTermsAt: at,
    createdAt: at,
    updatedAt: at,
  });
  await ensurePublicProfile(services, { ...session, displayName });
}
