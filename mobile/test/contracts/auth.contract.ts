import { emptyAura } from '@/domain/aura';
import type { AuthSession } from '@/domain/types';
import type { ContractFactory } from './util';
import { waitFor } from './util';

export interface AuthContractOptions {
  /** Firestore passes `false` until Task 4 implements deleteAccount. */
  supportsLifecycle?: boolean;
}

export function authRepositoryContract(
  name: string,
  make: ContractFactory,
  options: AuthContractOptions = {},
): void {
  const itLifecycle = options.supportsLifecycle === false ? it.skip : it;
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

    itLifecycle('deleteAccount with a wrong password rejects and the session stays', async () => {
      const s = await ctx.repos.auth.register('del1@example.com', 'secret12', 'Del');
      const emitted: (AuthSession | null)[] = [];
      const unsub = ctx.repos.auth.subscribe((x) => emitted.push(x));
      try {
        await expect(ctx.repos.auth.deleteAccount('nope-nope')).rejects.toThrow('Incorrect password.');
        await new Promise((r) => setTimeout(r, 100));
        expect(emitted[emitted.length - 1]?.userId).toBe(s.userId);
      } finally {
        unsub();
      }
    });

    itLifecycle('deleteAccount with the right password signs out and removes the memories', async () => {
      const s = await ctx.repos.auth.register('del2@example.com', 'secret12', 'Del');
      const emitted: (AuthSession | null)[] = [];
      const unsub = ctx.repos.auth.subscribe((x) => emitted.push(x));
      try {
        const t = new Date('2026-01-01T00:00:00Z');
        await ctx.repos.places.create({
          id: 'dp', name: 'Memory Place', latitude: 1, longitude: 2, geohash: 's01mtw', communityId: null,
          custodianIds: [s.userId], aura: emptyAura(t), memoryCount: 0,
          publicMemoryCount: 0, createdAt: t, updatedAt: t,
        });
        await ctx.repos.memories.create({
          id: 'dm', userId: s.userId, placeId: 'dp', imageUrl: null, audioUrl: null, textContent: 'x',
          latitude: 1, longitude: 2, geohash: 's01mtw',
          sentiment: { compound: 0, positive: 0, neutral: 1, negative: 0 },
          privacy: 'public', taggedUserIds: [], communityId: null, releaseDate: null,
          isDeleted: false, deletedAt: null, createdAt: t, updatedAt: t,
        });
        await ctx.repos.auth.deleteAccount('secret12');
        await waitFor(() => expect(emitted[emitted.length - 1]).toBeNull());
        await ctx.signInAs('observer');
        await waitFor(async () => expect(await ctx.repos.memories.findById('dm')).toBeNull());
      } finally {
        unsub();
      }
    });
  });
}
