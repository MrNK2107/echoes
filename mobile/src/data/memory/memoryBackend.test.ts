import { createMemoryBackend } from './index';
import { placeRepositoryContract } from '../../../test/contracts/places.contract';
import { memoryRepositoryContract } from '../../../test/contracts/memories.contract';
import { authRepositoryContract } from '../../../test/contracts/auth.contract';

import { userRepositoryContract } from '../../../test/contracts/users.contract';

/** Contract identities are pre-registered so `signInAs(uid)` yields a session with that uid. */
const CONTRACT_UIDS = ['author', 'viewer', 'stranger', 'friend', 'custodian', 'observer'];

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
      isDeleted: false, deletedAt: null, createdAt: now, updatedAt: now,
    });
    const p = await repos.places.findById('p');
    expect(p?.updatedAt).toEqual(now);
    expect(p?.memoryCount).toBe(1);
    expect(p?.publicMemoryCount).toBe(0);
  });
});
