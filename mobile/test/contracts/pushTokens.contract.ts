import type { ContractFactory } from './util';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-10-19T09:00:00Z');
const TOKEN = 'ExponentPushToken[contract-token-1]';

export function pushTokenRepositoryContract(name: string, make: ContractFactory): void {
  describe(`PushTokenRepository contract: ${name}`, () => {
    let ctx: Awaited<ReturnType<ContractFactory>>;
    beforeEach(async () => { ctx = await make(); await ctx.signInAs('author'); });
    afterEach(async () => { await ctx.cleanup(); });

    it('register creates the token with createdAt = lastSeenAt', async () => {
      await ctx.repos.pushTokens.register('author', TOKEN, 'android', T0);
      expect(await ctx.repos.pushTokens.get('author', TOKEN)).toEqual({
        token: TOKEN, platform: 'android', createdAt: T0, lastSeenAt: T0,
      });
    });

    it('registering again within 24 hours changes nothing', async () => {
      await ctx.repos.pushTokens.register('author', TOKEN, 'ios', T0);
      await ctx.repos.pushTokens.register('author', TOKEN, 'ios', new Date(T0.getTime() + DAY));
      expect((await ctx.repos.pushTokens.get('author', TOKEN))?.lastSeenAt).toEqual(T0);
    });

    it('registering after more than 24 hours refreshes only lastSeenAt', async () => {
      await ctx.repos.pushTokens.register('author', TOKEN, 'ios', T0);
      const later = new Date(T0.getTime() + DAY + 1000);
      await ctx.repos.pushTokens.register('author', TOKEN, 'ios', later);
      expect(await ctx.repos.pushTokens.get('author', TOKEN)).toEqual({
        token: TOKEN, platform: 'ios', createdAt: T0, lastSeenAt: later,
      });
    });

    it('unregister deletes the token; a missing token is fine', async () => {
      await ctx.repos.pushTokens.register('author', TOKEN, 'android', T0);
      await ctx.repos.pushTokens.unregister('author', TOKEN);
      expect(await ctx.repos.pushTokens.get('author', TOKEN)).toBeNull();
      await expect(ctx.repos.pushTokens.unregister('author', TOKEN)).resolves.toBeUndefined();
    });
  });
}
