import { createMemoryBackend, createMemoryBackendWithAdmin } from './index';
import { placeRepositoryContract } from '../../../test/contracts/places.contract';
import { memoryRepositoryContract } from '../../../test/contracts/memories.contract';
import { authRepositoryContract } from '../../../test/contracts/auth.contract';

import { userRepositoryContract } from '../../../test/contracts/users.contract';
import {
  LIMIT_UIDS,
  notificationRepositoryContract,
  profileRepositoryContract,
  safetyRepositoryContract,
} from '../../../test/contracts/social.contract';
import {
  auraHistoryContract,
  communityRepositoryContract,
  institutionRepositoryContract,
  transferRepositoryContract,
} from '../../../test/contracts/communities.contract';
import type { AppNotification, Repositories } from '../types';
import type { AppUser, Memory } from '@/domain/types';

/** Contract identities are pre-registered so `signInAs(uid)` yields a session with that uid. */
const CONTRACT_UIDS = ['author', 'viewer', 'stranger', 'friend', 'custodian', 'observer', ...LIMIT_UIDS];

const make = async () => {
  const { repos, admin } = createMemoryBackendWithAdmin({
    places: [], memories: [], users: [],
    credentials: CONTRACT_UIDS.map((uid) => ({
      userId: uid, email: `${uid}@contract.test`, password: 'pw-contract', displayName: uid,
    })),
  });
  // setAccount may change an email; sign-in is by email, so remember the current one.
  const emails = new Map(CONTRACT_UIDS.map((uid) => [uid, `${uid}@contract.test`]));
  return {
    repos,
    signInAs: async (uid: string) => { await repos.auth.signIn(emails.get(uid) ?? '', 'pw-contract'); },
    setAccount: async (uid: string, patch: { email?: string; emailVerified?: boolean; staff?: boolean }) => {
      admin.updateAccount(uid, patch);
      if (patch.email !== undefined) emails.set(uid, patch.email);
    },
    cleanup: async () => {},
  };
};

placeRepositoryContract('memory', make);
memoryRepositoryContract('memory', make);
authRepositoryContract('memory', make);
userRepositoryContract('memory', make);
profileRepositoryContract('memory', make);
notificationRepositoryContract('memory', make);
safetyRepositoryContract('memory', make);
communityRepositoryContract('memory', make);
transferRepositoryContract('memory', make);
institutionRepositoryContract('memory', make);
auraHistoryContract('memory', make);

describe('memory backend specifics', () => {
  it('upload returns the local uri unchanged', async () => {
    const repos = createMemoryBackend();
    expect(
      await repos.media.uploadMemoryImage({ userId: 'u', memoryId: 'm', localUri: 'file:///x.jpg' }),
    ).toBe('file:///x.jpg');
  });

  it('pre-registered credentials can sign in', async () => {
    const repos = createMemoryBackend({
      places: [], memories: [], users: [],
      credentials: [{ userId: 'u1', email: 'd@x.com', password: 'pw123456', displayName: 'Demo' }],
    });
    expect(await repos.auth.signIn('d@x.com', 'pw123456')).toEqual({
      userId: 'u1', email: 'd@x.com', displayName: 'Demo',
    });
  });

  it('uses injectable clock for aggregation updatedAt', async () => {
    const now = new Date('2026-03-03T00:00:00Z');
    const repos = createMemoryBackend(undefined, { now: () => now });
    await repos.places.create({
      id: 'p', name: 'p', latitude: 0, longitude: 0, geohash: 's00000', communityId: null,
      custodianIds: [], aura: { dominantSentiment: 'neutral', compoundScore: 0, intensity: 0, memoryCount: 0, colorHex: '#000000', updatedAt: now },
      memoryCount: 0, publicMemoryCount: 0, createdAt: now, updatedAt: new Date(0),
    });
    await repos.memories.create({
      id: 'm', userId: 'u', placeId: 'p', imageUrl: null, audioUrl: null, textContent: 'x',
      latitude: 0, longitude: 0, geohash: 's00000',
      sentiment: { compound: 0, positive: 0, neutral: 1, negative: 0 },
      privacy: 'private', taggedUserIds: [], communityId: null, releaseDate: null,
      isDeleted: false, deletedAt: null, moderation: null, createdAt: now, updatedAt: now,
    });
    const p = await repos.places.findById('p');
    expect(p?.updatedAt).toEqual(now);
    expect(p?.memoryCount).toBe(1);
    expect(p?.publicMemoryCount).toBe(0);
  });
});

describe('memory backend server emulation', () => {
  const T = new Date('2026-05-01T00:00:00Z');
  let repos: Repositories;
  let seq = 0;

  const mem = (over: Partial<Memory> = {}): Memory => {
    seq += 1;
    return {
      id: `e${seq}`, userId: 'author', placeId: 'p', imageUrl: null, audioUrl: null, textContent: 'x',
      latitude: 0, longitude: 0, geohash: 's00000',
      sentiment: { compound: 0, positive: 0, neutral: 1, negative: 0 },
      privacy: 'tagged', taggedUserIds: ['friend'], communityId: null, releaseDate: null,
      isDeleted: false, deletedAt: null, moderation: null, createdAt: T, updatedAt: T,
      ...over,
    };
  };
  const user = (id: string, over: Partial<AppUser> = {}): AppUser => ({
    id, displayName: id, email: null, photoUrl: null, defaultPrivacy: 'public', managedPlaceIds: [],
    communityIds: [], notificationPrefs: { transfers: true, tags: true, communityInvites: true },
    acceptedTermsAt: T, createdAt: T, updatedAt: T, ...over,
  });
  const signInAs = (uid: string) => repos.auth.signIn(`${uid}@x.test`, 'pw-test');
  const inbox = (uid: string): AppNotification[] => {
    let out: AppNotification[] = [];
    repos.notifications.subscribe(uid, (ns) => { out = ns; })();
    return out;
  };

  beforeEach(() => {
    repos = createMemoryBackend(
      {
        places: [], memories: [], users: [user('friend'), user('author')],
        credentials: ['author', 'friend', 'r1', 'r2', 'r3'].map((uid) => ({
          userId: uid, email: `${uid}@x.test`, password: 'pw-test', displayName: uid,
        })),
      },
      { now: () => T },
    );
  });

  it('seed users get public profiles so demo search works', async () => {
    expect(await repos.profiles.get('friend')).toEqual({ id: 'friend', displayName: 'friend' });
  });

  it('uses Someone when the author has no public profile', async () => {
    await signInAs('author');
    await repos.memories.create(mem({ userId: 'ghost' }));
    expect(inbox('friend').map((n) => n.body)).toEqual(['Someone tagged you in a memory.']);
  });

  it('does not notify for memories the tagged user cannot read', async () => {
    await signInAs('author');
    for (const privacy of ['private', 'community', 'timeRelease'] as const) {
      await repos.memories.create(mem({ privacy }));
    }
    await repos.memories.create(mem({ isDeleted: true, deletedAt: T }));
    expect(inbox('friend')).toEqual([]);
    await repos.memories.create(mem({ privacy: 'public' }));
    expect(inbox('friend')).toHaveLength(1);
  });

  it('skips the author, users without a users doc and duplicate tags', async () => {
    await signInAs('author');
    await repos.memories.create(mem({ taggedUserIds: ['author', 'nobody', 'friend', 'friend'] }));
    expect(inbox('author')).toEqual([]);
    expect(inbox('nobody')).toEqual([]);
    expect(inbox('friend')).toHaveLength(1);
  });

  it('honours the tags preference', async () => {
    await repos.users.updateNotificationPrefs(
      'friend', { transfers: true, tags: false, communityInvites: true }, T,
    );
    await signInAs('author');
    await repos.memories.create(mem());
    expect(inbox('friend')).toEqual([]);
  });

  it('honours blocks in both directions', async () => {
    await repos.safety.block('friend', 'author', T);
    await signInAs('author');
    await repos.memories.create(mem());
    expect(inbox('friend')).toEqual([]);
    await repos.safety.unblock('friend', 'author');
    await repos.safety.block('author', 'friend', T);
    await repos.memories.create(mem());
    expect(inbox('friend')).toEqual([]);
  });

  it('refuses to block yourself', async () => {
    await expect(repos.safety.block('author', 'author', T)).rejects.toThrow(
      'Something went wrong. Please try again.',
    );
  });

  it('hides at the third distinct reporter and the author still reads it', async () => {
    await signInAs('author');
    const m = mem({ privacy: 'public', taggedUserIds: [] });
    await repos.memories.create(m);
    for (const r of ['r1', 'r2', 'r3']) {
      await signInAs(r);
      await repos.safety.reportMemory({ memoryId: m.id, reason: 'spam', note: null });
    }
    expect(await repos.memories.findById(m.id)).toBeNull();
    await signInAs('author');
    expect((await repos.memories.findById(m.id))?.moderation).toBe('hidden');
  });

  it('rejects an invalid reason or a note over 280 characters with generic copy', async () => {
    await signInAs('author');
    const m = mem({ privacy: 'public', taggedUserIds: [] });
    await repos.memories.create(m);
    await signInAs('r1');
    await expect(
      repos.safety.reportMemory({ memoryId: m.id, reason: 'bogus' as never, note: null }),
    ).rejects.toThrow('Something went wrong. Please try again.');
    await expect(
      repos.safety.reportMemory({ memoryId: m.id, reason: 'spam', note: 'x'.repeat(281) }),
    ).rejects.toThrow('Something went wrong. Please try again.');
  });

  it('allows 20 reports a day, then rejects with the rate copy', async () => {
    await signInAs('author');
    const ms = Array.from({ length: 21 }, () => mem({ privacy: 'public', taggedUserIds: [] }));
    for (const m of ms) await repos.memories.create(m);
    await signInAs('r1');
    for (const m of ms.slice(0, 20)) {
      await repos.safety.reportMemory({ memoryId: m.id, reason: 'spam', note: null });
    }
    await expect(
      repos.safety.reportMemory({ memoryId: ms[20]!.id, reason: 'spam', note: null }),
    ).rejects.toThrow("You've sent a lot of reports today. Try again tomorrow.");
  });

  it('reporting requires a session', async () => {
    await expect(
      repos.safety.reportMemory({ memoryId: 'x', reason: 'spam', note: null }),
    ).rejects.toThrow('Something went wrong. Please try again.');
  });

  it('deleteAccount removes the public profile, inbox and blocks', async () => {
    const s = await repos.auth.register('gone@x.test', 'pw-test-1', 'Gone', T);
    await repos.safety.block(s.userId, 'friend', T);
    await repos.auth.deleteAccount('pw-test-1');
    expect(await repos.profiles.get(s.userId)).toBeNull();
    let blocks: string[] = ['sentinel'];
    repos.safety.subscribeBlocks(s.userId, (ids) => { blocks = ids; })();
    expect(blocks).toEqual([]);
  });
});

describe('memory backend communities, transfers and institutions emulation', () => {
  const T = new Date('2026-05-01T00:00:00Z');
  const DAY = 24 * 60 * 60 * 1000;
  const GENERIC = 'Something went wrong. Please try again.';
  let repos: Repositories;
  let admin: ReturnType<typeof createMemoryBackendWithAdmin>['admin'];
  let now: Date;
  let seq = 0;

  const user = (id: string): AppUser => ({
    id, displayName: id, email: null, photoUrl: null, defaultPrivacy: 'public', managedPlaceIds: [],
    communityIds: [], notificationPrefs: { transfers: true, tags: true, communityInvites: true },
    acceptedTermsAt: T, createdAt: T, updatedAt: T,
  });
  const mem = (over: Partial<Memory> = {}): Memory => {
    seq += 1;
    return {
      id: `x${seq}`, userId: 'author', placeId: 'p', imageUrl: null, audioUrl: null, textContent: 'x',
      latitude: 0, longitude: 0, geohash: 's00000',
      sentiment: { compound: 0.5, positive: 0.5, neutral: 0.5, negative: 0 },
      privacy: 'public', taggedUserIds: [], communityId: null, releaseDate: null,
      isDeleted: false, deletedAt: null, moderation: null, createdAt: T, updatedAt: T,
      ...over,
    };
  };
  const place = (custodianIds: string[]) => ({
    id: 'p', name: 'Old Banyan', latitude: 0, longitude: 0, geohash: 's00000', communityId: null,
    custodianIds,
    aura: {
      dominantSentiment: 'neutral' as const, compoundScore: 0, intensity: 0, memoryCount: 0,
      colorHex: '#000000', updatedAt: T,
    },
    memoryCount: 0, publicMemoryCount: 0, createdAt: T, updatedAt: T,
  });
  const signInAs = (uid: string) => repos.auth.signIn(`${uid}@x.test`, 'pw-test');
  /** The value a subscription emits synchronously on subscribe. */
  const latest = <V,>(sub: (cb: (v: V) => void) => () => void): V => {
    let out: V | undefined;
    sub((v) => { out = v; })();
    return out as V;
  };
  const inbox = (uid: string): AppNotification[] => latest((cb) => repos.notifications.subscribe(uid, cb));
  const mine = (uid: string) =>
    latest<{ id: string }[]>((cb) => repos.communities.subscribeMine(uid, cb)).map((c) => c.id);

  beforeEach(async () => {
    now = T;
    const handle = createMemoryBackendWithAdmin(
      {
        places: [place(['author'])], memories: [],
        users: ['author', 'friend', 'viewer'].map(user),
        credentials: ['author', 'friend', 'viewer', 'stranger'].map((uid) => ({
          userId: uid, email: `${uid}@x.test`, password: 'pw-test', displayName: uid,
        })),
      },
      { now: () => now },
    );
    repos = handle.repos;
    admin = handle.admin;
  });

  it('auto communities are system owned and leaving the year community is sticky (R25, R26)', async () => {
    await signInAs('author');
    await repos.memories.create(mem());
    expect(mine('author')).toEqual(['time-2026']);
    expect(await repos.communities.findById('time-2026')).toMatchObject({
      ownerId: 'system', memberCount: 1, description: 'Memories from 2026.',
    });
    expect(await repos.communities.findById('era-2020s')).toMatchObject({
      ownerId: 'system', memberCount: 0, description: 'Memories from the 2020s.',
    });
    await repos.communities.leave('time-2026');
    await repos.memories.create(mem());
    expect(mine('author')).toEqual([]);
    expect((await repos.communities.findById('time-2026'))?.memberCount).toBe(0);
    // Joining again clears the sticky flag.
    await repos.communities.join('time-2026');
    expect(mine('author')).toEqual(['time-2026']);
  });

  it('time communities skip deleted memories; users without a users doc join without a link', async () => {
    await signInAs('stranger');
    await repos.memories.create(mem({ userId: 'stranger', isDeleted: true, deletedAt: T }));
    expect(await repos.communities.findById('time-2026')).toBeNull();
    await repos.memories.create(mem({ userId: 'stranger' }));
    expect((await repos.communities.findById('time-2026'))?.memberCount).toBe(1);
    expect(
      latest((cb) => repos.communities.subscribeMembership('time-2026', 'stranger', cb)),
    ).toMatchObject({ role: 'member' });
    expect(mine('stranger')).toEqual([]);
  });

  it('a place gets its geo community at the fifth public memory', async () => {
    await signInAs('author');
    for (let i = 0; i < 4; i += 1) await repos.memories.create(mem());
    await repos.memories.create(mem({ privacy: 'private' }));
    expect(await repos.communities.findById('geo-p')).toBeNull();
    await repos.memories.create(mem());
    expect(await repos.communities.findById('geo-p')).toMatchObject({
      name: 'Old Banyan Circle', type: 'geographic', ownerId: 'system', placeId: 'p', memberCount: 0,
      description: 'Memories shared at Old Banyan.',
    });
    expect((await repos.places.findById('p'))?.communityId).toBe('geo-p');
  });

  it('aura history keeps the 14 newest entries, oldest first', async () => {
    await signInAs('author');
    for (let i = 0; i < 16; i += 1) {
      now = new Date(T.getTime() + i * 1000);
      await repos.memories.create(mem());
    }
    const entries = latest<{ aura: { memoryCount: number } }[]>((cb) =>
      repos.places.subscribeAuraHistory('p', cb),
    );
    expect(entries.map((e) => e.aura.memoryCount)).toEqual(Array.from({ length: 14 }, (_, i) => i + 3));
  });

  it('invites skip self, members, users without a doc, blocked pairs and disabled prefs', async () => {
    await signInAs('author');
    const id = await repos.communities.create({ name: 'Club', description: 'd' });
    await signInAs('viewer');
    await repos.communities.join(id);
    const prefs = (communityInvites: boolean) => ({ transfers: true, tags: true, communityInvites });
    await repos.users.updateNotificationPrefs('friend', prefs(false), T);
    await signInAs('author');
    await repos.communities.invite(id, ['author', 'viewer', 'nobody', 'friend']);
    expect(inbox('friend')).toEqual([]);
    expect(inbox('viewer')).toEqual([]);
    await repos.users.updateNotificationPrefs('friend', prefs(true), T);
    await repos.safety.block('friend', 'author', T);
    await repos.communities.invite(id, ['friend']);
    expect(inbox('friend')).toEqual([]);
    await repos.safety.unblock('friend', 'author');
    await repos.communities.invite(id, ['friend']);
    expect(inbox('friend').map((n) => n.body)).toEqual(['author invited you to join Club.']);
  });

  it('the invite limit counts unique invitees, 200 a day (R27)', async () => {
    await signInAs('author');
    const id = await repos.communities.create({ name: 'Club', description: 'd' });
    const batch = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
    for (let i = 0; i < 9; i += 1) await repos.communities.invite(id, batch(20, `u${i}-`));
    await repos.communities.invite(id, Array.from({ length: 20 }, () => 'same'));
    await repos.communities.invite(id, batch(19, 'last-'));
    await expect(repos.communities.invite(id, ['one-more'])).rejects.toThrow(GENERIC);
    await expect(repos.communities.invite(id, batch(21, 'too-many-'))).rejects.toThrow(GENERIC);
  });

  it('create validates its input and allows 10 communities a day', async () => {
    await signInAs('author');
    await expect(repos.communities.create({ name: '  ', description: 'd' })).rejects.toThrow(GENERIC);
    await expect(repos.communities.create({ name: 'x'.repeat(61), description: 'd' })).rejects.toThrow(GENERIC);
    for (let i = 0; i < 10; i += 1) await repos.communities.create({ name: `c${i}`, description: 'd' });
    await expect(repos.communities.create({ name: 'c10', description: 'd' })).rejects.toThrow(GENERIC);
    expect(latest<unknown[]>((cb) => repos.communities.subscribeDiscover(cb))).toHaveLength(10);
  });

  it('discover lists the 50 largest communities, largest first', async () => {
    await signInAs('author');
    for (let day = 0; day < 6; day += 1) {
      now = new Date(T.getTime() + day * DAY);
      for (let i = 0; i < 10; i += 1) await repos.communities.create({ name: `d${day}-${i}`, description: 'd' });
    }
    const listed = latest<{ id: string }[]>((cb) => repos.communities.subscribeDiscover(cb));
    expect(listed).toHaveLength(50);
    await signInAs('viewer');
    await repos.communities.join(listed[49]!.id);
    const after = latest<{ id: string; memberCount: number }[]>((cb) => repos.communities.subscribeDiscover(cb));
    expect(after[0]).toMatchObject({ id: listed[49]!.id, memberCount: 2 });
  });

  it('feed: members do not see hidden memories; their authors still do', async () => {
    await signInAs('author');
    const id = await repos.communities.create({ name: 'Club', description: 'd' });
    const shared = mem({ privacy: 'community', communityId: id });
    await repos.memories.create(shared);
    for (const r of ['friend', 'viewer', 'stranger']) {
      await signInAs(r);
      await repos.communities.join(id);
      await repos.safety.reportMemory({ memoryId: shared.id, reason: 'spam', note: null });
    }
    const feed = (viewerId: string) =>
      latest<Memory[]>((cb) =>
        repos.communities.subscribeFeed(id, { viewerId, viewerCommunityIds: [id], now: T }, cb),
      ).map((m) => m.id);
    expect(feed('viewer')).toEqual([]);
    expect(feed('author')).toEqual([shared.id]);
  });

  it('transfers refuse self, blocked pairs, unknown recipients and unknown places', async () => {
    await repos.profiles.setDisplayName('friend', 'Fen', T);
    await signInAs('author');
    await expect(repos.transfers.initiate({ placeId: 'p', toUserId: 'author' })).rejects.toThrow(GENERIC);
    await expect(repos.transfers.initiate({ placeId: 'p', toUserId: 'ghost' })).rejects.toThrow(GENERIC);
    await expect(repos.transfers.initiate({ placeId: 'nope', toUserId: 'friend' })).rejects.toThrow(GENERIC);
    await repos.safety.block('friend', 'author', T);
    await expect(repos.transfers.initiate({ placeId: 'p', toUserId: 'friend' })).rejects.toThrow(GENERIC);
    await repos.safety.unblock('friend', 'author');
    await repos.transfers.initiate({ placeId: 'p', toUserId: 'friend' });
    const [t] = latest<{ id: string }[]>((cb) => repos.transfers.subscribeIncoming('friend', cb));
    // Blocking after the request stops the accept, but declining still works.
    await repos.safety.block('author', 'friend', T);
    await signInAs('friend');
    await expect(repos.transfers.respond(t!.id, true)).rejects.toThrow(GENERIC);
    await repos.transfers.respond(t!.id, false);
    await repos.transfers.respond(t!.id, false); // repeating the same answer is a no-op
    await expect(repos.transfers.respond(t!.id, true)).rejects.toThrow(GENERIC);
  });

  it('only the recipient responds, only the sender revokes, within the 7-day window', async () => {
    await repos.profiles.setDisplayName('friend', 'Fen', T);
    await signInAs('author');
    await repos.transfers.initiate({ placeId: 'p', toUserId: 'friend' });
    const [t] = latest<{ id: string }[]>((cb) => repos.transfers.subscribeHistory('author', cb));
    await expect(repos.transfers.respond(t!.id, true)).rejects.toThrow(GENERIC);
    await signInAs('friend');
    await expect(repos.transfers.revoke(t!.id)).rejects.toThrow(GENERIC);
    await repos.transfers.respond(t!.id, true);
    expect(inbox('author').map((n) => n.body)).toEqual(['Fen accepted custodianship of Old Banyan.']);
    now = new Date(T.getTime() + 7 * DAY + 1);
    await signInAs('author');
    await expect(repos.transfers.revoke(t!.id)).rejects.toThrow(GENERIC);
    expect((await repos.places.findById('p'))?.custodianIds).toEqual(['author', 'friend']);
  });

  it('expiry re-emits to open transfer subscriptions', async () => {
    await repos.profiles.setDisplayName('friend', 'Fen', T);
    await signInAs('author');
    await repos.transfers.initiate({ placeId: 'p', toUserId: 'friend' });
    const seen: string[][] = [];
    const unsub = repos.transfers.subscribeHistory('author', (ts) => seen.push(ts.map((t) => t.status)));
    try {
      expect(seen).toEqual([['pending']]);
      now = new Date(T.getTime() + 7 * DAY + 1);
      // Any transfer read runs the expiry; the already-open history subscription must hear of it.
      latest<unknown[]>((cb) => repos.transfers.subscribeIncoming('friend', cb));
      expect(seen[seen.length - 1]).toEqual(['expired']);
    } finally {
      unsub();
    }
  });

  it('pending requests expire after 7 days and cannot be accepted', async () => {
    await repos.profiles.setDisplayName('friend', 'Fen', T);
    await signInAs('author');
    await repos.transfers.initiate({ placeId: 'p', toUserId: 'friend' });
    now = new Date(T.getTime() + 7 * DAY + 1);
    const history = latest<{ id: string; status: string }[]>((cb) =>
      repos.transfers.subscribeHistory('author', cb),
    );
    expect(history.map((t) => t.status)).toEqual(['expired']);
    expect(latest<unknown[]>((cb) => repos.transfers.subscribeIncoming('friend', cb))).toEqual([]);
    await signInAs('friend');
    await expect(repos.transfers.respond(history[0]!.id, true)).rejects.toThrow(GENERIC);
    // An expired request no longer blocks a new one.
    await signInAs('author');
    await repos.transfers.initiate({ placeId: 'p', toUserId: 'friend' });
  });

  it('an onward request fails once its sender is no longer a custodian', async () => {
    await repos.profiles.setDisplayName('friend', 'Fen', T);
    await repos.profiles.setDisplayName('viewer', 'Vik', T);
    await signInAs('author');
    await repos.transfers.initiate({ placeId: 'p', toUserId: 'friend' });
    const [ab] = latest<{ id: string }[]>((cb) => repos.transfers.subscribeIncoming('friend', cb));
    await signInAs('friend');
    await repos.transfers.respond(ab!.id, true);
    await repos.transfers.initiate({ placeId: 'p', toUserId: 'viewer' });
    const [bc] = latest<{ id: string }[]>((cb) => repos.transfers.subscribeIncoming('viewer', cb));
    await signInAs('author');
    await repos.transfers.revoke(ab!.id);
    await repos.transfers.revoke(ab!.id); // revoking twice is a no-op
    expect(latest<{ status: string }[]>((cb) => repos.transfers.subscribeHistory('viewer', cb))[0]?.status).toBe(
      'revoked',
    );
    await signInAs('viewer');
    await expect(repos.transfers.respond(bc!.id, true)).rejects.toThrow(GENERIC);
  });

  it('institutions: domains are normalised, subdomains are refused, sub-zones are capped at 100', async () => {
    await signInAs('author');
    admin.updateAccount('author', { staff: true });
    await expect(
      repos.institutions.create({ name: 'U', allowedEmailDomains: ['not a domain'] }),
    ).rejects.toThrow(GENERIC);
    const id = await repos.institutions.create({ name: 'U', allowedEmailDomains: ['Uni.edu'] });
    await signInAs('viewer');
    admin.updateAccount('viewer', { email: 'v@cs.uni.edu', emailVerified: true });
    await expect(repos.institutions.claimAdmin(id)).rejects.toThrow(
      "Your email domain isn't approved for this institution.",
    );
    admin.updateAccount('viewer', { email: 'V@UNI.EDU' });
    await repos.institutions.claimAdmin(id);
    await repos.institutions.claimAdmin(id); // idempotent
    expect((await repos.communities.findById(`inst-${id}`))?.memberCount).toBe(1);
    for (let i = 0; i < 100; i += 1) {
      await repos.institutions.addSubZone(id, { name: `z${i}`, latitude: 0, longitude: 0 });
    }
    await expect(
      repos.institutions.addSubZone(id, { name: 'z100', latitude: 0, longitude: 0 }),
    ).rejects.toThrow(GENERIC);
    await expect(
      repos.institutions.addSubZone(id, { name: 'bad', latitude: 91, longitude: 0 }),
    ).rejects.toThrow(GENERIC);
  });

  it('demo mode: sending the verification email verifies the address', async () => {
    await signInAs('viewer');
    expect((await repos.auth.refreshUser()).emailVerified).toBe(false);
    await repos.auth.sendEmailVerification();
    expect(await repos.auth.refreshUser()).toEqual({ email: 'viewer@x.test', emailVerified: true, staff: false });
  });

  it('callables need a session', async () => {
    await expect(repos.communities.create({ name: 'a', description: 'b' })).rejects.toThrow(GENERIC);
    await expect(repos.transfers.initiate({ placeId: 'p', toUserId: 'friend' })).rejects.toThrow(GENERIC);
    await expect(repos.institutions.claimAdmin('x')).rejects.toThrow(GENERIC);
  });
});
