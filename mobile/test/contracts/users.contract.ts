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
      const s = await ctx.repos.auth.register('pref@example.com', 'secret12', 'Pref');
      expect((await ctx.repos.users.get(s.userId))?.defaultPrivacy).toBe('public');
      const at = new Date();
      await ctx.repos.users.updateDefaultPrivacy(s.userId, 'private', at);
      await waitFor(async () => {
        const u = await ctx.repos.users.get(s.userId);
        expect(u?.defaultPrivacy).toBe('private');
        expect(u?.updatedAt).toEqual(at);
      });
    });
  });
}
