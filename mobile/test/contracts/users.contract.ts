import type { ContractFactory } from './util';
import { waitFor } from './util';

export interface UserContractOptions {
  /** Firestore passes `false` until Task 4 implements updateDefaultPrivacy. */
  supportsLifecycle?: boolean;
}

export function userRepositoryContract(
  name: string,
  make: ContractFactory,
  options: UserContractOptions = {},
): void {
  const itLifecycle = options.supportsLifecycle === false ? it.skip : it;
  describe(`UserRepository contract: ${name}`, () => {
    let ctx: Awaited<ReturnType<ContractFactory>>;
    beforeEach(async () => { ctx = await make(); });
    afterEach(async () => { await ctx.cleanup(); });

    itLifecycle('updateDefaultPrivacy persists', async () => {
      const s = await ctx.repos.auth.register('pref@example.com', 'secret12', 'Pref', new Date());
      expect((await ctx.repos.users.get(s.userId))?.defaultPrivacy).toBe('public');
      const at = new Date();
      await ctx.repos.users.updateDefaultPrivacy(s.userId, 'private', at);
      await waitFor(async () => {
        const u = await ctx.repos.users.get(s.userId);
        expect(u?.defaultPrivacy).toBe('private');
        expect(u?.updatedAt).toEqual(at);
      });
    });

    it('create refuses an existing doc and leaves it unchanged', async () => {
      const s = await ctx.repos.auth.register('exists@example.com', 'secret12', 'Exists', new Date());
      const before = await ctx.repos.users.get(s.userId);
      expect(before).not.toBeNull();
      await expect(ctx.repos.users.create({ ...before!, displayName: 'Overwritten', communityIds: [] })).rejects.toThrow();
      expect(await ctx.repos.users.get(s.userId)).toEqual(before);
    });

    it('updateNotificationPrefs persists', async () => {
      const s = await ctx.repos.auth.register('notif@example.com', 'secret12', 'Notif', new Date());
      const at = new Date();
      const prefs = { transfers: false, tags: true, communityInvites: false };
      await ctx.repos.users.updateNotificationPrefs(s.userId, prefs, at);
      await waitFor(async () => {
        const u = await ctx.repos.users.get(s.userId);
        expect(u?.notificationPrefs).toEqual(prefs);
        expect(u?.updatedAt).toEqual(at);
      });
    });
  });
}
