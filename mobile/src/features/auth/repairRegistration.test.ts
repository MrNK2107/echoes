import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { DISPLAY_NAME_ERROR } from '@/domain/profiles';
import type { AuthSession } from '@/domain/types';

import { completeRegistration, needsRepair } from './repairRegistration';

const SESSION: AuthSession = { userId: 'user-new', email: 'new@echoes.app', displayName: null };

describe('repairRegistration', () => {
  it('needs repair exactly when users/{uid} is missing', async () => {
    const services = testServices();
    expect(await needsRepair(services, SESSION)).toBe(true);
    expect(await needsRepair(services, { userId: 'user-demo', email: DEMO_USER.email, displayName: null })).toBe(false);
  });

  it('creates the users doc with the terms time and register defaults, then the public profile', async () => {
    const services = testServices();
    const at = new Date('2026-10-19T10:00:00Z');
    await completeRegistration(services, SESSION, '  Asha  ', at);
    const user = await services.repos.users.get('user-new');
    expect(user).toMatchObject({
      id: 'user-new',
      displayName: 'Asha',
      email: 'new@echoes.app',
      defaultPrivacy: 'public',
      acceptedTermsAt: at,
      managedPlaceIds: [],
      communityIds: [],
    });
    expect((await services.repos.profiles.get('user-new'))?.displayName).toBe('Asha');
    expect(await needsRepair(services, SESSION)).toBe(false);
  });

  it('rejects an invalid name without writing', async () => {
    const services = testServices();
    await expect(completeRegistration(services, SESSION, 'A', new Date())).rejects.toThrow(DISPLAY_NAME_ERROR);
    expect(await needsRepair(services, SESSION)).toBe(true);
  });
});
