import { Timestamp } from 'firebase/firestore';
import {
  memoryFromDoc,
  memoryToDoc,
  notificationFromDoc,
  placeFromDoc,
  placeToDoc,
  profileFromDoc,
  profileToDoc,
  userFromDoc,
  userToDoc,
} from './mappers';
import type { AppUser, Memory, Place } from '../domain/types';

const d = (s: string) => new Date(s);

const memory: Memory = {
  id: 'm1',
  userId: 'u1',
  placeId: 'p1',
  imageUrl: null,
  audioUrl: 'https://a/b.m4a',
  textContent: 'hello',
  latitude: 1.5,
  longitude: 2.5,
  geohash: 'abc',
  sentiment: { compound: 0.4, positive: 0.5, neutral: 0.4, negative: 0.1 },
  privacy: 'timeRelease',
  taggedUserIds: ['u2'],
  communityId: null,
  releaseDate: d('2030-01-01T00:00:00.000Z'),
  isDeleted: false,
  deletedAt: null,
  moderation: null,
  createdAt: d('2026-01-02T03:04:05.000Z'),
  updatedAt: d('2026-01-03T03:04:05.000Z'),
};

const place: Place = {
  id: 'p1',
  name: 'Spot',
  latitude: 1,
  longitude: 2,
  geohash: 'abc',
  communityId: null,
  custodianIds: ['u1'],
  aura: {
    dominantSentiment: 'mixed',
    compoundScore: 0.2,
    intensity: 0.5,
    memoryCount: 10,
    colorHex: '#DDA0DD',
    updatedAt: d('2026-02-01T00:00:00.000Z'),
  },
  memoryCount: 12,
  publicMemoryCount: 10,
  createdAt: d('2026-01-01T00:00:00.000Z'),
  updatedAt: d('2026-02-01T00:00:00.000Z'),
};

const user: AppUser = {
  id: 'u1',
  displayName: null,
  email: 'a@b.c',
  photoUrl: null,
  defaultPrivacy: 'private',
  managedPlaceIds: [],
  communityIds: ['c1'],
  notificationPrefs: { transfers: true, tags: false, communityInvites: true },
  acceptedTermsAt: d('2026-01-01T00:00:00.000Z'),
  createdAt: d('2026-01-01T00:00:00.000Z'),
  updatedAt: d('2026-01-02T00:00:00.000Z'),
};

describe('memory mapper', () => {
  it('round-trips', () => {
    expect(memoryFromDoc(memory.id, memoryToDoc(memory))).toEqual(memory);
  });
  it('writes Timestamps and nulls', () => {
    const doc = memoryToDoc(memory);
    expect(doc.createdAt).toBeInstanceOf(Timestamp);
    expect(doc.releaseDate).toBeInstanceOf(Timestamp);
    expect(doc.imageUrl).toBeNull();
    expect(doc.deletedAt).toBeNull();
    // firestore.rules requires new memories to carry moderation: null (ADR-0008)
    expect(doc).toHaveProperty('moderation', null);
    expect(doc).not.toHaveProperty('id');
  });
  it('reads legacy ISO date strings', () => {
    const doc = { ...memoryToDoc(memory), createdAt: '2025-01-02T03:04:05.000Z' };
    expect(memoryFromDoc('m1', doc).createdAt).toEqual(d('2025-01-02T03:04:05.000Z'));
  });
  it('maps missing optionals to null', () => {
    const doc = memoryToDoc(memory);
    delete doc.imageUrl;
    delete doc.releaseDate;
    delete doc.communityId;
    const m = memoryFromDoc('m1', doc);
    expect(m.imageUrl).toBeNull();
    expect(m.releaseDate).toBeNull();
    expect(m.communityId).toBeNull();
    expect(m.moderation).toBeNull();
  });
  it('reads the server-written hidden moderation and always writes null on create', () => {
    const doc = { ...memoryToDoc(memory), moderation: 'hidden' };
    expect(memoryFromDoc('m1', doc).moderation).toBe('hidden');
    expect(memoryToDoc({ ...memory, moderation: 'hidden' }).moderation).toBeNull();
  });
});

describe('place mapper', () => {
  it('writes ISO strings', () => {
    const doc = placeToDoc(place);
    expect(doc.createdAt).toBe(place.createdAt.toISOString());
    expect(doc.aura.updatedAt).toBe(place.aura.updatedAt.toISOString());
  });
  it('round-trips', () => {
    expect(placeFromDoc(place.id, placeToDoc(place))).toEqual(place);
  });
});

describe('user mapper', () => {
  it('writes ISO strings and nulls', () => {
    const doc = userToDoc(user);
    expect(doc.createdAt).toBe(user.createdAt.toISOString());
    expect(doc.displayName).toBeNull();
  });
  it('round-trips and defaults missing optionals to null', () => {
    expect(userFromDoc(user.id, userToDoc(user))).toEqual(user);
    const doc = userToDoc(user);
    delete doc.photoUrl;
    expect(userFromDoc(user.id, doc).photoUrl).toBeNull();
  });
  it('writes acceptedTermsAt as ISO and notification prefs as booleans', () => {
    const doc = userToDoc(user);
    expect(doc.acceptedTermsAt).toBe('2026-01-01T00:00:00.000Z');
    expect(doc.notificationPrefs).toEqual({ transfers: true, tags: false, communityInvites: true });
  });
  it('omits a null acceptedTermsAt (the rules require a string when present)', () => {
    expect(userToDoc({ ...user, acceptedTermsAt: null })).not.toHaveProperty('acceptedTermsAt');
  });
  it('defaults missing prefs to enabled and missing acceptedTermsAt to null (Plan 1/2 docs)', () => {
    const doc = userToDoc(user);
    delete doc.notificationPrefs;
    delete doc.acceptedTermsAt;
    const u = userFromDoc(user.id, doc);
    expect(u.notificationPrefs).toEqual({ transfers: true, tags: true, communityInvites: true });
    expect(u.acceptedTermsAt).toBeNull();
  });
});

describe('public profile mapper', () => {
  it('writes the trimmed name, its search key and an ISO updatedAt', () => {
    expect(profileToDoc('  Zoë Ángel  ', d('2026-05-01T00:00:00.000Z'))).toEqual({
      displayName: 'Zoë Ángel',
      displayNameLower: 'zoe angel',
      updatedAt: '2026-05-01T00:00:00.000Z',
    });
  });
  it('reads only the public fields', () => {
    expect(profileFromDoc('u1', { displayName: 'Zoë', displayNameLower: 'zoe', updatedAt: 'x' })).toEqual({
      id: 'u1',
      displayName: 'Zoë',
    });
  });
});

describe('notification mapper', () => {
  it('maps ISO dates and keeps only string data values', () => {
    expect(
      notificationFromDoc('n1', {
        type: 'memoryTagged',
        title: 'Tagged in a memory',
        body: 'Ana tagged you in a memory.',
        data: { memoryId: 'm1', placeId: null },
        createdAt: '2026-05-01T00:00:00.000Z',
        readAt: null,
      }),
    ).toEqual({
      id: 'n1',
      type: 'memoryTagged',
      title: 'Tagged in a memory',
      body: 'Ana tagged you in a memory.',
      data: { memoryId: 'm1' },
      createdAt: d('2026-05-01T00:00:00.000Z'),
      readAt: null,
    });
  });
  it('maps readAt when set', () => {
    const n = notificationFromDoc('n1', {
      type: 'communityInvite', title: 't', body: 'b', createdAt: '2026-05-01T00:00:00.000Z',
      readAt: '2026-05-02T00:00:00.000Z',
    });
    expect(n.readAt).toEqual(d('2026-05-02T00:00:00.000Z'));
    expect(n.data).toEqual({});
  });
});
