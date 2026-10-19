import { emptyAura } from '@/domain/aura';
import type { AuthSession } from '@/domain/types';
import type { ContractFactory } from './util';
import { waitFor } from './util';

const TERMS_AT = new Date('2026-04-01T10:00:00.000Z');

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
        const session = await ctx.repos.auth.register('new@example.com', 'secret12', 'Newbie', TERMS_AT);
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
      const s = await ctx.repos.auth.register('a@example.com', 'secret12', 'Al', TERMS_AT);
      await ctx.repos.auth.signOut();
      expect((await ctx.repos.auth.signIn('a@example.com', 'secret12')).userId).toBe(s.userId);
      await expect(ctx.repos.auth.signIn('a@example.com', 'wrong-pass')).rejects.toThrow(
        'Incorrect email or password.',
      );
    });

    it('register stores acceptedTermsAt, default notification prefs and the public profile', async () => {
      const s = await ctx.repos.auth.register('terms@example.com', 'secret12', ' Terry ', TERMS_AT);
      expect(s.displayName).toBe('Terry');
      await waitFor(async () => {
        const user = await ctx.repos.users.get(s.userId);
        expect(user?.acceptedTermsAt).toEqual(TERMS_AT);
        expect(user?.notificationPrefs).toEqual({ transfers: true, tags: true, communityInvites: true });
      });
      expect(await ctx.repos.profiles.get(s.userId)).toEqual({ id: s.userId, displayName: 'Terry' });
    });

    it('register rejects a display name outside 2 to 40 characters before creating the account', async () => {
      await expect(ctx.repos.auth.register('short@example.com', 'secret12', 'Z', TERMS_AT)).rejects.toThrow(
        'Use 2 to 40 characters.',
      );
      await expect(ctx.repos.auth.signIn('short@example.com', 'secret12')).rejects.toThrow(
        'Incorrect email or password.',
      );
    });

    it('duplicate register rejects', async () => {
      await ctx.repos.auth.register('dup@example.com', 'secret12', 'Dee', TERMS_AT);
      await expect(ctx.repos.auth.register('dup@example.com', 'secret12', 'Dee2', TERMS_AT)).rejects.toThrow(
        'An account already exists for that email.',
      );
    });

    it('refreshUser reports the email, its verification and the staff claim', async () => {
      await expect(ctx.repos.auth.refreshUser()).rejects.toThrow('Not signed in.');
      await expect(ctx.repos.auth.sendEmailVerification()).rejects.toThrow('Not signed in.');
      await ctx.repos.auth.register('ver@example.com', 'secret12', 'Vera', TERMS_AT);
      expect(await ctx.repos.auth.refreshUser()).toEqual({
        email: 'ver@example.com', emailVerified: false, staff: false,
      });
      await expect(ctx.repos.auth.sendEmailVerification()).resolves.toBeUndefined();
    });

    it('sendPasswordReset resolves the same for a known and an unknown address, and keeps the session', async () => {
      await ctx.repos.auth.register('reset@example.com', 'secret12', 'Rita', TERMS_AT);
      await expect(ctx.repos.auth.sendPasswordReset('reset@example.com')).resolves.toBeUndefined();
      await expect(ctx.repos.auth.sendPasswordReset('nobody-here@example.com')).resolves.toBeUndefined();
      expect((await ctx.repos.auth.refreshUser()).email).toBe('reset@example.com');
    });

    it('sendPasswordReset rejects a malformed address', async () => {
      await expect(ctx.repos.auth.sendPasswordReset('not-an-email')).rejects.toThrow('Enter a valid email');
    });

    itLifecycle('deleteAccount with a wrong password rejects and the session stays', async () => {
      const s = await ctx.repos.auth.register('del1@example.com', 'secret12', 'Del', TERMS_AT);
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
      const s = await ctx.repos.auth.register('del2@example.com', 'secret12', 'Del', TERMS_AT);
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
          isDeleted: false, deletedAt: null, moderation: null, createdAt: t, updatedAt: t,
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
