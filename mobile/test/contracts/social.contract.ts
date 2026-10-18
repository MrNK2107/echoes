import type { AppNotification } from '@/data/types';
import type { AppUser, Memory } from '@/domain/types';
import type { ContractFactory } from './util';
import { waitFor } from './util';

const T = new Date('2026-01-01T00:00:00Z');
const NOW = new Date('2026-06-01T00:00:00Z');
const PLACE_ID = 'place-1';

/** Identities the limit case signs in as; the memory backend pre-registers them too. */
export const LIMIT_UIDS = Array.from({ length: 12 }, (_, i) => `lim${String(i + 1).padStart(2, '0')}`);

let seq = 0;
function mem(over: Partial<Memory> = {}): Memory {
  seq += 1;
  const created = new Date(T.getTime() + seq * 1000);
  return {
    id: `s${seq}`, userId: 'author', placeId: PLACE_ID, imageUrl: null, audioUrl: null,
    textContent: 'a lovely day', latitude: 12.97, longitude: 77.59, geohash: 'tdr1vz',
    sentiment: { compound: 0.6, positive: 0.6, neutral: 0.4, negative: 0 },
    privacy: 'public', taggedUserIds: [], communityId: null, releaseDate: null,
    isDeleted: false, deletedAt: null, moderation: null, createdAt: created, updatedAt: created,
    ...over,
  };
}

export function appUser(id: string): AppUser {
  return {
    id, displayName: id, email: `${id}@contract.test`, photoUrl: null, defaultPrivacy: 'public',
    managedPlaceIds: [], communityIds: [],
    notificationPrefs: { transfers: true, tags: true, communityInvites: true },
    acceptedTermsAt: T, createdAt: T, updatedAt: T,
  };
}

export function profileRepositoryContract(name: string, make: ContractFactory): void {
  describe(`ProfileRepository contract: ${name}`, () => {
    let ctx: Awaited<ReturnType<ContractFactory>>;
    beforeEach(async () => { ctx = await make(); });
    afterEach(async () => { await ctx.cleanup(); });

    async function setName(uid: string, displayName: string) {
      await ctx.signInAs(uid);
      await ctx.repos.profiles.setDisplayName(uid, displayName, new Date());
    }

    it('setDisplayName trims and get returns the public profile; unknown is null', async () => {
      await setName('author', '  Zoë Ángel  ');
      expect(await ctx.repos.profiles.get('author')).toEqual({ id: 'author', displayName: 'Zoë Ángel' });
      expect(await ctx.repos.profiles.get('nobody')).toBeNull();
    });

    it('setDisplayName rejects names outside 2 to 40 characters', async () => {
      await ctx.signInAs('author');
      await expect(ctx.repos.profiles.setDisplayName('author', ' a ', new Date())).rejects.toThrow(
        'Use 2 to 40 characters.',
      );
      expect(await ctx.repos.profiles.get('author')).toBeNull();
    });

    it('getMany returns the profiles that exist, keyed by id', async () => {
      await setName('author', 'Ana');
      await setName('viewer', 'Vik');
      const got = await ctx.repos.profiles.getMany(['author', 'viewer', 'missing', 'author']);
      expect([...got.keys()].sort()).toEqual(['author', 'viewer']);
      expect(got.get('viewer')).toEqual({ id: 'viewer', displayName: 'Vik' });
      expect((await ctx.repos.profiles.getMany([])).size).toBe(0);
    });

    it('search is a case- and diacritic-insensitive prefix match that can exclude self', async () => {
      await setName('author', 'Zoë Ángel');
      await setName('viewer', 'zoe Bright');
      await setName('stranger', 'Zack');
      expect((await ctx.repos.profiles.search('ZOE', {})).map((p) => p.id)).toEqual(['author', 'viewer']);
      expect((await ctx.repos.profiles.search('zoë b', {})).map((p) => p.id)).toEqual(['viewer']);
      expect((await ctx.repos.profiles.search('zo', { excludeUid: 'author' })).map((p) => p.id)).toEqual([
        'viewer',
      ]);
      expect(await ctx.repos.profiles.search('q', {})).toEqual([]);
    });

    it('search needs two characters and returns at most 10', async () => {
      for (const uid of LIMIT_UIDS) await setName(uid, `Lim ${uid}`);
      expect(await ctx.repos.profiles.search('l', {})).toEqual([]);
      const found = await ctx.repos.profiles.search('lim', { excludeUid: 'lim01' });
      expect(found).toHaveLength(10);
      expect(found.map((p) => p.id)).toEqual(LIMIT_UIDS.slice(1, 11));
    });
  });
}

export function notificationRepositoryContract(name: string, make: ContractFactory): void {
  describe(`NotificationRepository contract: ${name}`, () => {
    let ctx: Awaited<ReturnType<ContractFactory>>;
    beforeEach(async () => {
      ctx = await make();
      // Tag notifications go only to users who have a users doc (functions/tags.js).
      await ctx.signInAs('friend');
      await ctx.repos.users.create(appUser('friend'));
      await ctx.signInAs('author');
      await ctx.repos.profiles.setDisplayName('author', 'Ana', new Date());
    });
    afterEach(async () => { await ctx.cleanup(); });

    async function inboxOf(uid: string, until: (ns: AppNotification[]) => void): Promise<AppNotification[]> {
      await ctx.signInAs(uid);
      let latest: AppNotification[] | null = null;
      const unsub = ctx.repos.notifications.subscribe(uid, (ns) => { latest = ns; });
      try {
        await waitFor(() => {
          expect(latest).not.toBeNull();
          until(latest as unknown as AppNotification[]);
        });
        return latest as unknown as AppNotification[];
      } finally {
        unsub();
      }
    }

    it('a tagged user is notified and can mark it read', async () => {
      const m = mem({ privacy: 'tagged', taggedUserIds: ['friend'] });
      await ctx.repos.memories.create(m);
      const [n] = await inboxOf('friend', (ns) => expect(ns).toHaveLength(1));
      expect(n).toMatchObject({
        type: 'memoryTagged',
        title: 'Tagged in a memory',
        body: 'Ana tagged you in a memory.',
        readAt: null,
      });
      expect(n!.data.memoryId).toBe(m.id);
      const at = new Date('2026-06-02T00:00:00Z');
      await ctx.repos.notifications.markRead('friend', n!.id, at);
      await inboxOf('friend', (ns) => expect(ns[0]?.readAt).toEqual(at));
    });

    it('markRead of an unknown notification rejects with generic copy', async () => {
      await ctx.signInAs('friend');
      await expect(ctx.repos.notifications.markRead('friend', 'missing', new Date())).rejects.toThrow(
        'Something went wrong. Please try again.',
      );
    });

    it('lists newest first and markAllRead marks every unread item', async () => {
      const a = mem({ taggedUserIds: ['friend'] });
      await ctx.repos.memories.create(a);
      await inboxOf('friend', (ns) => expect(ns).toHaveLength(1));
      await ctx.signInAs('author');
      const b = mem({ taggedUserIds: ['friend'] });
      await ctx.repos.memories.create(b);
      const both = await inboxOf('friend', (ns) => expect(ns).toHaveLength(2));
      expect(both.map((n) => n.data.memoryId)).toEqual([b.id, a.id]);
      const at = new Date('2026-06-03T00:00:00Z');
      await ctx.repos.notifications.markAllRead('friend', at);
      await inboxOf('friend', (ns) => expect(ns.map((n) => n.readAt)).toEqual([at, at]));
    });
  });
}

export function safetyRepositoryContract(name: string, make: ContractFactory): void {
  describe(`SafetyRepository contract: ${name}`, () => {
    let ctx: Awaited<ReturnType<ContractFactory>>;
    beforeEach(async () => { ctx = await make(); });
    afterEach(async () => { await ctx.cleanup(); });

    async function blocksOf(uid: string, expected: string[]): Promise<void> {
      let latest: string[] | null = null;
      const unsub = ctx.repos.safety.subscribeBlocks(uid, (ids) => { latest = ids; });
      try {
        await waitFor(() => expect(latest).toEqual(expected));
      } finally {
        unsub();
      }
    }

    it('block lists blocked users newest first; unblock removes them', async () => {
      await ctx.signInAs('author');
      await blocksOf('author', []);
      await ctx.repos.safety.block('author', 'viewer', new Date('2026-05-01T00:00:00Z'));
      await ctx.repos.safety.block('author', 'stranger', new Date('2026-05-02T00:00:00Z'));
      await blocksOf('author', ['stranger', 'viewer']);
      await ctx.repos.safety.unblock('author', 'viewer');
      await blocksOf('author', ['stranger']);
    });

    async function visibleIds(viewerId: string): Promise<string[]> {
      await ctx.signInAs(viewerId);
      let latest: Memory[] | null = null;
      const unsub = ctx.repos.memories.subscribeVisibleForPlace(
        { placeId: PLACE_ID, viewerId, viewerCommunityIds: [], now: NOW },
        (ms) => { latest = ms; },
      );
      try {
        await waitFor(() => expect(latest).not.toBeNull());
        return ((latest as Memory[] | null) ?? []).map((m) => m.id);
      } finally {
        unsub();
      }
    }

    async function report(uid: string, memoryId: string) {
      await ctx.signInAs(uid);
      await ctx.repos.safety.reportMemory({ memoryId, reason: 'spam', note: null });
    }

    it('three distinct reports hide a memory from others but not from its author', async () => {
      const m = mem();
      const other = mem();
      await ctx.signInAs('author');
      await ctx.repos.memories.create(m);
      await ctx.repos.memories.create(other);
      await report('viewer', m.id);
      await ctx.signInAs('stranger');
      await ctx.repos.safety.reportMemory({ memoryId: m.id, reason: 'harassment', note: 'mean words' });
      expect(await visibleIds('observer')).toContain(m.id);
      await report('friend', m.id);
      await waitFor(async () => expect(await visibleIds('observer')).toEqual([other.id]));
      expect(await ctx.repos.memories.findById(m.id)).toBeNull();
      expect(await visibleIds('author')).toEqual([other.id, m.id]);
      expect((await ctx.repos.memories.findById(m.id))?.moderation).toBe('hidden');
    });

    it('a duplicate report rejects with the duplicate copy; own memory with generic copy', async () => {
      const m = mem();
      await ctx.signInAs('author');
      await ctx.repos.memories.create(m);
      await expect(
        ctx.repos.safety.reportMemory({ memoryId: m.id, reason: 'spam', note: null }),
      ).rejects.toThrow('Something went wrong. Please try again.');
      await report('viewer', m.id);
      await expect(
        ctx.repos.safety.reportMemory({ memoryId: m.id, reason: 'other', note: null }),
      ).rejects.toThrow('You already reported this memory.');
    });

    it('reporting a memory the reporter cannot see rejects with generic copy', async () => {
      const m = mem({ privacy: 'private' });
      await ctx.signInAs('author');
      await ctx.repos.memories.create(m);
      await ctx.signInAs('viewer');
      await expect(
        ctx.repos.safety.reportMemory({ memoryId: m.id, reason: 'spam', note: null }),
      ).rejects.toThrow('Something went wrong. Please try again.');
    });
  });
}
