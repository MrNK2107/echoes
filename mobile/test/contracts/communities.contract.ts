import { emptyAura } from '@/domain/aura';
import type { Community, CommunityMembership, Institution, Memory, Place, Transfer } from '@/domain/types';
import type { AppNotification } from '@/data/types';
import { appUser } from './social.contract';
import type { ContractFactory } from './util';
import { observe, waitFor } from './util';

const T = new Date('2026-01-01T00:00:00Z');
const NOW = new Date('2026-06-01T00:00:00Z');
const GENERIC = 'Something went wrong. Please try again.';
const DAY_MS = 24 * 60 * 60 * 1000;

let seq = 0;
function mem(over: Partial<Memory> = {}): Memory {
  seq += 1;
  const created = new Date(T.getTime() + seq * 1000);
  return {
    id: `c${seq}`, userId: 'author', placeId: 'place-1', imageUrl: null, audioUrl: null,
    textContent: 'a lovely day', latitude: 12.97, longitude: 77.59, geohash: 'tdr1vz',
    sentiment: { compound: 0.6, positive: 0.6, neutral: 0.4, negative: 0 },
    privacy: 'public', taggedUserIds: [], communityId: null, releaseDate: null,
    isDeleted: false, deletedAt: null, moderation: null, createdAt: created, updatedAt: created,
    ...over,
  };
}

function place(id: string, custodian: string): Place {
  return {
    id, name: 'Memory Place', latitude: 12.97, longitude: 77.59, geohash: 'tdr1vzz', communityId: null,
    custodianIds: [custodian], aura: emptyAura(T), memoryCount: 0, publicMemoryCount: 0,
    createdAt: T, updatedAt: T,
  };
}

type Ctx = Awaited<ReturnType<ContractFactory>>;

async function inboxOf(ctx: Ctx, uid: string, until: (ns: AppNotification[]) => void) {
  await ctx.signInAs(uid);
  return observe<AppNotification[]>((cb) => ctx.repos.notifications.subscribe(uid, cb), until);
}

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

export function communityRepositoryContract(name: string, make: ContractFactory): void {
  describe(`CommunityRepository contract: ${name}`, () => {
    let ctx: Ctx;
    beforeEach(async () => {
      ctx = await make();
      // users/{uid}.communityIds backs subscribeMine; the server only links existing users docs.
      for (const uid of ['viewer', 'friend', 'stranger', 'author']) {
        await ctx.signInAs(uid);
        await ctx.repos.users.create(appUser(uid));
      }
      await ctx.repos.profiles.setDisplayName('author', 'Ana', new Date());
    });
    afterEach(async () => { await ctx.cleanup(); });

    const mine = (uid: string, until: (cs: Community[]) => void) =>
      observe<Community[]>((cb) => ctx.repos.communities.subscribeMine(uid, cb), until);
    const memberCount = (id: string, n: number) =>
      waitFor(async () => expect((await ctx.repos.communities.findById(id))?.memberCount).toBe(n));
    const roleOf = (id: string, uid: string, role: string | null) =>
      observe<CommunityMembership | null>((cb) => ctx.repos.communities.subscribeMembership(id, uid, cb), (m) =>
        expect(m?.role ?? null).toBe(role),
      );

    it('create makes the caller the owner and lists it in Mine and Discover', async () => {
      const id = await ctx.repos.communities.create({ name: '  Book Club ', description: 'We read.' });
      expect(await ctx.repos.communities.findById(id)).toMatchObject({
        id, name: 'Book Club', description: 'We read.', type: 'thematic', ownerId: 'author',
        placeId: null, institutionId: null, memberCount: 1,
      });
      await roleOf(id, 'author', 'owner');
      await mine('author', (cs) => expect(ids(cs)).toContain(id));
      await observe<Community[]>((cb) => ctx.repos.communities.subscribeDiscover(cb), (cs) =>
        expect(ids(cs)).toContain(id),
      );
      expect(await ctx.repos.communities.findById('missing')).toBeNull();
    });

    it('join and leave update the membership, the count and Mine; owners cannot leave', async () => {
      const id = await ctx.repos.communities.create({ name: 'Walkers', description: 'We walk.' });
      await ctx.signInAs('viewer');
      await ctx.repos.communities.join(id);
      await roleOf(id, 'viewer', 'member');
      await memberCount(id, 2);
      await mine('viewer', (cs) => expect(ids(cs)).toEqual([id]));
      await ctx.repos.communities.leave(id);
      await roleOf(id, 'viewer', null);
      await memberCount(id, 1);
      await mine('viewer', (cs) => expect(cs).toEqual([]));
      await ctx.signInAs('author');
      await expect(ctx.repos.communities.leave(id)).rejects.toThrow("Owners can't leave their community.");
    });

    it('members invite people with a users doc; non-members cannot invite', async () => {
      const id = await ctx.repos.communities.create({ name: 'Book Club', description: 'We read.' });
      await ctx.repos.communities.invite(id, ['friend', 'author', 'friend']);
      const [n] = await inboxOf(ctx, 'friend', (ns) => expect(ns).toHaveLength(1));
      expect(n).toMatchObject({
        type: 'communityInvite',
        title: 'Community invitation',
        body: 'Ana invited you to join Book Club.',
      });
      expect(n!.data.communityId).toBe(id);
      await ctx.signInAs('stranger');
      await expect(ctx.repos.communities.invite(id, ['viewer'])).rejects.toThrow(GENERIC);
    });

    it('the feed shows community memories to members only', async () => {
      const id = await ctx.repos.communities.create({ name: 'Book Club', description: 'We read.' });
      await ctx.signInAs('viewer');
      await ctx.repos.communities.join(id);
      await ctx.signInAs('author');
      const shared = mem({ privacy: 'community', communityId: id });
      await ctx.repos.memories.create(shared);
      await ctx.repos.memories.create(mem());

      const feed = async (viewerId: string, viewerCommunityIds: string[], expected: string[]) => {
        await ctx.signInAs(viewerId);
        await observe<Memory[]>(
          (cb) => ctx.repos.communities.subscribeFeed(id, { viewerId, viewerCommunityIds, now: NOW }, cb),
          (ms) => expect(ids(ms)).toEqual(expected),
        );
      };
      await feed('viewer', [id], [shared.id]);
      await feed('author', [id], [shared.id]);
      await feed('stranger', [], []);
      // A stale membership list proves nothing: the server still checks membership.
      await feed('stranger', [id], []);
    });

    it('creating a memory joins its author to the year community (system owned)', async () => {
      await ctx.repos.memories.create(mem({ createdAt: new Date('2025-03-04T00:00:00Z') }));
      await mine('author', (cs) => expect(ids(cs)).toContain('time-2025'));
      expect(await ctx.repos.communities.findById('time-2025')).toMatchObject({
        name: '2025 Memories', type: 'timeBased', ownerId: 'system', memberCount: 1,
      });
      expect(await ctx.repos.communities.findById('era-2020s')).toMatchObject({
        name: '2020s Era', type: 'timeBased', ownerId: 'system',
      });
      await roleOf('time-2025', 'author', 'member');
    });
  });
}

export function transferRepositoryContract(name: string, make: ContractFactory): void {
  describe(`TransferRepository contract: ${name}`, () => {
    let ctx: Ctx;
    beforeEach(async () => {
      ctx = await make();
      // initiateTransfer requires the recipient's public profile.
      const names: Record<string, string> = { viewer: 'Vik', friend: 'Fen', custodian: 'Cara' };
      for (const [uid, displayName] of Object.entries(names)) {
        await ctx.signInAs(uid);
        await ctx.repos.profiles.setDisplayName(uid, displayName, new Date());
      }
      await ctx.repos.places.create(place('tp', 'custodian'));
    });
    afterEach(async () => { await ctx.cleanup(); });

    const incoming = async (uid: string, until: (ts: Transfer[]) => void) => {
      await ctx.signInAs(uid);
      return observe<Transfer[]>((cb) => ctx.repos.transfers.subscribeIncoming(uid, cb), until);
    };
    const history = async (uid: string, until: (ts: Transfer[]) => void) => {
      await ctx.signInAs(uid);
      return observe<Transfer[]>((cb) => ctx.repos.transfers.subscribeHistory(uid, cb), until);
    };
    const custodians = (expected: string[]) =>
      waitFor(async () => expect((await ctx.repos.places.findById('tp'))?.custodianIds).toEqual(expected));

    it('request, duplicate refused, accept adds a custodian, revoke removes them', async () => {
      await ctx.repos.transfers.initiate({ placeId: 'tp', toUserId: 'viewer' });
      await expect(ctx.repos.transfers.initiate({ placeId: 'tp', toUserId: 'viewer' })).rejects.toThrow(
        'A request to this person is already pending.',
      );
      const [t] = await incoming('viewer', (ts) => expect(ts).toHaveLength(1));
      expect(t).toMatchObject({
        placeId: 'tp', fromUserId: 'custodian', toUserId: 'viewer', status: 'pending', respondedAt: null,
      });
      expect(t!.revokeUntil.getTime() - t!.createdAt.getTime()).toBe(7 * DAY_MS);
      const [n] = await inboxOf(ctx, 'viewer', (ns) => expect(ns).toHaveLength(1));
      expect(n).toMatchObject({
        type: 'transferRequest', body: 'Cara wants you to become a custodian of Memory Place.',
      });
      expect(n!.data).toMatchObject({ transferId: t!.id, placeId: 'tp' });

      await ctx.repos.transfers.respond(t!.id, true);
      await incoming('viewer', (ts) => expect(ts).toEqual([]));
      await custodians(['custodian', 'viewer']);
      const [accepted] = await history('custodian', (ts) => expect(ts[0]?.status).toBe('accepted'));
      expect(accepted!.respondedAt).toBeInstanceOf(Date);

      await ctx.repos.transfers.revoke(t!.id);
      await history('custodian', (ts) => expect(ts.map((x) => x.status)).toEqual(['revoked']));
      await history('viewer', (ts) => expect(ts.map((x) => x.status)).toEqual(['revoked']));
      await custodians(['custodian']);
    });

    it('declining notifies the sender; only custodians can send', async () => {
      await ctx.repos.transfers.initiate({ placeId: 'tp', toUserId: 'friend' });
      const [t] = await incoming('friend', (ts) => expect(ts).toHaveLength(1));
      await ctx.repos.transfers.respond(t!.id, false);
      await history('friend', (ts) => expect(ts.map((x) => x.status)).toEqual(['rejected']));
      const [n] = await inboxOf(ctx, 'custodian', (ns) => expect(ns).toHaveLength(1));
      expect(n).toMatchObject({ type: 'transferRejected', body: 'Fen declined custodianship of Memory Place.' });
      await custodians(['custodian']);
      await ctx.signInAs('viewer');
      await expect(ctx.repos.transfers.initiate({ placeId: 'tp', toUserId: 'friend' })).rejects.toThrow(GENERIC);
    });

    it("revoking an accepted transfer also revokes the recipient's pending onward requests", async () => {
      await ctx.repos.transfers.initiate({ placeId: 'tp', toUserId: 'viewer' });
      const [t] = await incoming('viewer', (ts) => expect(ts).toHaveLength(1));
      await ctx.repos.transfers.respond(t!.id, true);
      await custodians(['custodian', 'viewer']);
      await ctx.repos.transfers.initiate({ placeId: 'tp', toUserId: 'friend' });
      await incoming('friend', (ts) => expect(ts).toHaveLength(1));
      await ctx.signInAs('custodian');
      await ctx.repos.transfers.revoke(t!.id);
      await incoming('friend', (ts) => expect(ts).toEqual([]));
      await history('friend', (ts) => expect(ts.map((x) => x.status)).toEqual(['revoked']));
      await custodians(['custodian']);
    });
  });
}

export function institutionRepositoryContract(name: string, make: ContractFactory): void {
  describe(`InstitutionRepository contract: ${name}`, () => {
    let ctx: Ctx;
    beforeEach(async () => {
      ctx = await make();
      await ctx.signInAs('viewer');
      await ctx.repos.users.create(appUser('viewer'));
      await ctx.signInAs('custodian');
    });
    afterEach(async () => { await ctx.cleanup(); });

    const registerAsStaff = async () => {
      await ctx.signInAs('custodian');
      await ctx.setAccount('custodian', { staff: true });
      return ctx.repos.institutions.create({ name: 'City Uni', allowedEmailDomains: [' Uni.EDU ', 'uni.edu'] });
    };

    it('only staff can register an institution, which gets a system-owned community', async () => {
      await expect(
        ctx.repos.institutions.create({ name: 'City Uni', allowedEmailDomains: ['uni.edu'] }),
      ).rejects.toThrow(GENERIC);
      const id = await registerAsStaff();
      expect(await ctx.repos.auth.refreshUser()).toMatchObject({ staff: true });
      expect(await ctx.repos.institutions.findById(id)).toEqual({
        id, name: 'City Uni', allowedEmailDomains: ['uni.edu'], subZones: [],
        communityId: `inst-${id}`,
      });
      expect(await ctx.repos.institutions.findById('missing')).toBeNull();
      await observe<Institution[]>((cb) => ctx.repos.institutions.subscribeAll(cb), (is) =>
        expect(ids(is)).toEqual([id]),
      );
      expect(await ctx.repos.communities.findById(`inst-${id}`)).toMatchObject({
        name: 'City Uni', type: 'institution', ownerId: 'system', institutionId: id, memberCount: 0,
      });
    });

    it('claiming admin needs a verified email in an allowed domain; admins add sub-zones', async () => {
      const id = await registerAsStaff();
      await ctx.signInAs('viewer');
      await ctx.setAccount('viewer', { email: 'vik@uni.edu', emailVerified: false });
      await observe<boolean>((cb) => ctx.repos.institutions.subscribeIsAdmin(id, 'viewer', cb), (isAdmin) =>
        expect(isAdmin).toBe(false),
      );
      await expect(ctx.repos.institutions.claimAdmin(id)).rejects.toThrow('Verify your email address first.');
      await ctx.setAccount('viewer', { email: 'vik@other.edu', emailVerified: true });
      expect(await ctx.repos.auth.refreshUser()).toEqual({ email: 'vik@other.edu', emailVerified: true, staff: false });
      await expect(ctx.repos.institutions.claimAdmin(id)).rejects.toThrow(
        "Your email domain isn't approved for this institution.",
      );
      await ctx.setAccount('viewer', { email: 'vik@uni.edu', emailVerified: true });
      await ctx.repos.institutions.claimAdmin(id);
      // The admin list is private: a user only sees whether they themselves are an admin.
      await observe<boolean>((cb) => ctx.repos.institutions.subscribeIsAdmin(id, 'viewer', cb), (isAdmin) =>
        expect(isAdmin).toBe(true),
      );
      expect(await ctx.repos.institutions.findById(id)).not.toHaveProperty('adminUserIds');
      await observe<CommunityMembership | null>((cb) => ctx.repos.communities.subscribeMembership(`inst-${id}`, 'viewer', cb), (m) =>
        expect(m?.role).toBe('guardian'),
      );
      await observe<Community[]>((cb) => ctx.repos.communities.subscribeMine('viewer', cb), (cs) =>
        expect(ids(cs)).toEqual([`inst-${id}`]),
      );

      await ctx.repos.institutions.addSubZone(id, { name: 'Library', latitude: 12.97, longitude: 77.59 });
      expect((await ctx.repos.institutions.findById(id))?.subZones).toEqual([
        { id: expect.any(String), name: 'Library', latitude: 12.97, longitude: 77.59, radiusMeters: 60 },
      ]);
      await ctx.signInAs('custodian');
      await expect(
        ctx.repos.institutions.addSubZone(id, { name: 'Gym', latitude: 1, longitude: 2 }),
      ).rejects.toThrow(GENERIC);
    });
  });
}

export function auraHistoryContract(name: string, make: ContractFactory): void {
  describe(`PlaceRepository aura history contract: ${name}`, () => {
    let ctx: Ctx;
    beforeEach(async () => {
      ctx = await make();
      await ctx.signInAs('author');
      await ctx.repos.places.create(place('ap', 'author'));
    });
    afterEach(async () => { await ctx.cleanup(); });

    const history = (until: (es: { aura: { memoryCount: number }; recordedAt: Date }[]) => void) =>
      observe((cb) => ctx.repos.places.subscribeAuraHistory('ap', cb), until);

    it('emits an entry per aggregate update, oldest first', async () => {
      await history((es) => expect(es).toEqual([]));
      await ctx.repos.memories.create(mem({ placeId: 'ap' }));
      await history((es) => expect(es.map((e) => e.aura.memoryCount)).toEqual([1]));
      await ctx.repos.memories.create(mem({ placeId: 'ap', sentiment: { compound: -0.8, positive: 0, neutral: 0.2, negative: 0.8 } }));
      const entries = await history((es) => expect(es.map((e) => e.aura.memoryCount)).toEqual([1, 2]));
      expect(entries[0]!.recordedAt.getTime()).toBeLessThanOrEqual(entries[1]!.recordedAt.getTime());
      await observe((cb) => ctx.repos.places.subscribeAuraHistory('nope', cb), (es) => expect(es).toEqual([]));
    });
  });
}
