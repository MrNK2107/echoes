import { buildSeed, DEMO_USER } from '@/data/seed';
import { SEED_CENTER, TEST_NOW } from '@/device/fakes';
import { createMemoryBackendWithAdmin } from './index';

const DEMO_UID = 'user-demo';

async function setup() {
  const { repos, admin } = createMemoryBackendWithAdmin(buildSeed(new Date(TEST_NOW), SEED_CENTER), {
    now: () => new Date(TEST_NOW),
  });
  await repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
  admin.updateAccount(DEMO_UID, { staff: true, emailVerified: true });
  const id = await repos.institutions.create({ name: 'Uni', allowedEmailDomains: ['echoes.app'] });
  return { repos, admin, id };
}

describe('memory institutions subscribeIsAdmin', () => {
  it('reports only the signed-in caller own role; other uids are false like the Firestore rules', async () => {
    const { repos, id } = await setup();
    await repos.institutions.claimAdmin(id);
    const seen: Record<string, boolean[]> = { me: [], other: [] };
    const a = repos.institutions.subscribeIsAdmin(id, DEMO_UID, (v) => seen.me.push(v));
    const b = repos.institutions.subscribeIsAdmin(id, 'someone-else', (v) => seen.other.push(v));
    expect(seen.me).toEqual([true]);
    expect(seen.other).toEqual([false]);
    a();
    b();
  });

  it('is false for an admin uid when that user is not the signed-in caller', async () => {
    const { repos, id } = await setup();
    await repos.institutions.claimAdmin(id);
    await repos.auth.signOut();
    const seen: boolean[] = [];
    repos.institutions.subscribeIsAdmin(id, DEMO_UID, (v) => seen.push(v));
    expect(seen).toEqual([false]);
  });

  it('notifies listeners when account deletion drops the admin role', async () => {
    const { repos, id } = await setup();
    await repos.institutions.claimAdmin(id);
    const seen: boolean[] = [];
    const off = repos.institutions.subscribeIsAdmin(id, DEMO_UID, (v) => seen.push(v));
    await repos.auth.deleteAccount(DEMO_USER.password);
    expect(seen[seen.length - 1]).toBe(false);
    off();
  });
});
