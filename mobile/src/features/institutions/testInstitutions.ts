import { act } from '@testing-library/react-native';

import { createMemoryBackendWithAdmin, type MemoryBackendAdmin } from '@/data/memory';
import { buildSeed, DEMO_USER } from '@/data/seed';
import { SEED_CENTER, TEST_NOW, testServices } from '@/device/fakes';
import type { Services } from '@/services/services';

export const DEMO_UID = 'user-demo';

/** testServices whose memory backend also exposes the admin API (staff claim, verified email). */
export function servicesWithAdmin(overrides: Partial<Services> = {}): { services: Services; admin: MemoryBackendAdmin } {
  const now = overrides.now ?? (() => new Date(TEST_NOW));
  const { repos, admin } = createMemoryBackendWithAdmin(buildSeed(new Date(TEST_NOW), SEED_CENTER), { now });
  return { services: testServices({ ...overrides, repos, now }), admin };
}

export async function signIn(services: Services) {
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
  });
}

/**
 * Registers an institution as a temporarily-staff demo user, then restores the flags it was given.
 * Must run while signed in.
 */
export async function registerInstitution(
  services: Services,
  admin: MemoryBackendAdmin,
  input: { name: string; allowedEmailDomains: string[] },
  flags: { staff?: boolean } = {},
): Promise<string> {
  let id = '';
  await act(async () => {
    admin.updateAccount(DEMO_UID, { staff: true });
    id = await services.repos.institutions.create(input);
    admin.updateAccount(DEMO_UID, { staff: flags.staff ?? false });
  });
  return id;
}
