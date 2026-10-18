import { createMemoryBackend } from './index';
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
import type { AppNotification, Repositories } from '../types';
import type { AppUser, Memory } from '@/domain/types';

/** Contract identities are pre-registered so `signInAs(uid)` yields a session with that uid. */
const CONTRACT_UIDS = ['author', 'viewer', 'stranger', 'friend', 'custodian', 'observer', ...LIMIT_UIDS];

const make = async () => {
  const repos = createMemoryBackend({
    places: [], memories: [], users: [],
    credentials: CONTRACT_UIDS.map((uid) => ({
      userId: uid, email: `${uid}@contract.test`, password: 'pw-contract', displayName: uid,
    })),
  });
  return {
    repos,
    signInAs: async (uid: string) => { await repos.auth.signIn(`${uid}@contract.test`, 'pw-contract'); },
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
