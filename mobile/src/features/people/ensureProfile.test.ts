import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import type { AuthSession } from '@/domain/types';
import type { Services } from '@/services/services';

import { CUSTODIAN_FALLBACK_NAME } from '@/domain/profiles';

import { ensurePublicProfile, fallbackDisplayName } from './ensureProfile';

const SESSION: AuthSession = { userId: 'user-demo', email: DEMO_USER.email, displayName: 'Session Name' };

function withoutProfile(services: Services) {
  jest.spyOn(services.repos.profiles, 'get').mockResolvedValue(null);
  return jest.spyOn(services.repos.profiles, 'setDisplayName');
}

describe('ensurePublicProfile', () => {
  it('does nothing when the profile exists', async () => {
    const services = testServices();
    const set = jest.spyOn(services.repos.profiles, 'setDisplayName');
    await ensurePublicProfile(services, SESSION);
    expect(set).not.toHaveBeenCalled();
  });

  it('creates the profile from the users doc name', async () => {
    const services = testServices();
    const set = withoutProfile(services);
    await ensurePublicProfile(services, SESSION);
    expect(set).toHaveBeenCalledWith('user-demo', DEMO_USER.displayName, services.now());
  });

  it('falls back to the session name when the users doc has none', async () => {
    const services = testServices();
    const set = withoutProfile(services);
    jest.spyOn(services.repos.users, 'get').mockResolvedValue(null);
    await ensurePublicProfile(services, SESSION);
    expect(set).toHaveBeenCalledWith('user-demo', 'Session Name', services.now());
  });

  it('never publishes the email: falls back to ECHOES custodian', async () => {
    const services = testServices();
    const set = withoutProfile(services);
    jest.spyOn(services.repos.users, 'get').mockResolvedValue(null);
    await ensurePublicProfile(services, { userId: 'user-demo', email: 'kavya.n@example.com', displayName: 'x' });
    expect(set).toHaveBeenCalledWith('user-demo', 'ECHOES custodian', services.now());
  });

  it('never throws when the repair fails', async () => {
    const services = testServices();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(services.repos.profiles, 'get').mockRejectedValue(new Error('offline'));
    await expect(ensurePublicProfile(services, SESSION)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('fallbackDisplayName', () => {
  it('trims and collapses spaces, cuts to 40 characters, and otherwise uses the custodian name', () => {
    expect(fallbackDisplayName(['  Ok   Name '])).toBe('Ok Name');
    expect(fallbackDisplayName([null, '', 'a'])).toBe('ECHOES custodian');
    expect(fallbackDisplayName(['b'.repeat(60)])).toBe('b'.repeat(40));
    expect(fallbackDisplayName(['x', 'Second Choice'])).toBe('Second Choice');
    expect(fallbackDisplayName([])).toBe(CUSTODIAN_FALLBACK_NAME);
  });
});
