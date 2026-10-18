import type { AuthSession } from '@/domain/types';
import type { ContractFactory } from './util';
import { waitFor } from './util';

export function authRepositoryContract(name: string, make: ContractFactory): void {
  describe(`AuthRepository contract: ${name}`, () => {
    let ctx: Awaited<ReturnType<ContractFactory>>;
    beforeEach(async () => { ctx = await make(); });
    afterEach(async () => { await ctx.cleanup(); });

    it('register returns a session with displayName, subscribe emits it, signOut emits null', async () => {
      const emitted: (AuthSession | null)[] = [];
      const unsub = ctx.repos.auth.subscribe((s) => emitted.push(s));
      try {
        const session = await ctx.repos.auth.register('new@example.com', 'secret12', 'Newbie');
        expect(session.displayName).toBe('Newbie');
        expect(session.email).toBe('new@example.com');
        expect(session.userId).toBeTruthy();
        await waitFor(() => expect(emitted.some((s) => s?.userId === session.userId)).toBe(true));
        await ctx.repos.auth.signOut();
        await waitFor(() => expect(emitted[emitted.length - 1]).toBeNull());
      } finally {
        unsub();
      }
    });

    it('signIn works after register; wrong password rejects', async () => {
      const s = await ctx.repos.auth.register('a@example.com', 'secret12', 'A');
      await ctx.repos.auth.signOut();
      expect((await ctx.repos.auth.signIn('a@example.com', 'secret12')).userId).toBe(s.userId);
      await expect(ctx.repos.auth.signIn('a@example.com', 'wrong-pass')).rejects.toThrow(
        'Incorrect email or password.',
      );
    });

    it('duplicate register rejects', async () => {
      await ctx.repos.auth.register('dup@example.com', 'secret12', 'D');
      await expect(ctx.repos.auth.register('dup@example.com', 'secret12', 'D2')).rejects.toThrow(
        'An account already exists for that email.',
      );
    });
  });
}
