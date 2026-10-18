import { DEMO_USER } from '@/data/seed';
import { fakeFiles, memoryKeyValue, SEED_CENTER, testServices, TEST_NOW } from '@/device/fakes';
import { analyzeSentiment } from '@/domain/sentiment';
import type { Memory } from '@/domain/types';
import { outboxDraft } from '@/features/outbox/fixtures';
import { Outbox } from '@/features/outbox/outbox';

import type { MemoryDraft } from './submitMemory';
import {
  isNetworkError,
  isPermanentError,
  prepareDraft,
  runDraft,
  submitMemory,
  SUBMIT_TIMEOUT_MS,
} from './submitMemory';

const draft = (o: Partial<MemoryDraft> = {}): MemoryDraft => ({
  textContent: 'A lovely quiet morning',
  privacy: 'public',
  releaseDate: null,
  taggedUserIds: [],
  communityId: null,
  location: SEED_CENTER,
  imageUri: null,
  audioUri: null,
  ...o,
});
const USER = 'user-demo';
const QUEUED_FAR = { latitude: 13.5, longitude: 78.5 };
const identity = { compress: async (u: string) => u };

function newOutbox() {
  return new Outbox(memoryKeyValue(), fakeFiles(), USER);
}

async function memoriesAt(services: ReturnType<typeof testServices>, placeId: string): Promise<Memory[]> {
  let latest: Memory[] = [];
  const off = services.repos.memories.subscribeVisibleForPlace(
    { placeId, viewerId: USER, viewerCommunityIds: [], now: services.now() },
    (m) => {
      latest = m;
    },
  );
  await Promise.resolve();
  off();
  return latest;
}

function firestoreError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

describe('submitMemory', () => {
  it('creates place p_<memoryId> when none is within 100 m', async () => {
    const s = testServices();
    const r = await submitMemory(s, USER, draft({ location: QUEUED_FAR }), newOutbox());
    if (!r.ok || r.queued) throw new Error('expected an online save');
    expect(r.placeId).toBe(`p_${r.memoryId}`);
    const place = await s.repos.places.findById(r.placeId);
    expect(place?.name).toBe('Memory Place');
    expect(place?.custodianIds).toEqual([USER]);
  });

  it('reuses the seeded place 40 m away', async () => {
    const s = testServices();
    const seeded = await s.repos.places.findById('place-2');
    if (!seeded) throw new Error('seed missing');
    const near = { latitude: seeded.latitude + 0.00036, longitude: seeded.longitude };
    const r = await submitMemory(s, USER, draft({ location: near }), newOutbox());
    if (!r.ok || r.queued) throw new Error('expected an online save');
    expect(r.placeId).toBe('place-2');
  });

  it('stores sentiment from the text', async () => {
    const s = testServices();
    const r = await submitMemory(s, USER, draft({ textContent: '  I love this wonderful place  ' }), newOutbox());
    if (!r.ok || r.queued) throw new Error('expected an online save');
    const m = (await memoriesAt(s, r.placeId)).find((x) => x.id === r.memoryId);
    expect(m?.sentiment).toEqual(analyzeSentiment('I love this wonderful place'));
    expect(m?.textContent).toBe('I love this wonderful place');
  });

  it('rejects whitespace-only text', async () => {
    const r = await submitMemory(testServices(), USER, draft({ textContent: '   ' }), newOutbox());
    expect(r).toEqual({ ok: false, error: 'Write something to remember.' });
  });

  it('rejects text over 2000 characters', async () => {
    const r = await submitMemory(testServices(), USER, draft({ textContent: 'a'.repeat(2001) }), newOutbox());
    expect(r).toEqual({ ok: false, error: 'Memories can be at most 2000 characters.' });
  });

  it('rejects a time release in the past and never queues it', async () => {
    const outbox = newOutbox();
    const r = await submitMemory(
      testServices(),
      USER,
      draft({ privacy: 'timeRelease', releaseDate: new Date('2020-01-01') }),
      outbox,
    );
    expect(r).toEqual({ ok: false, error: 'Choose a future release date.' });
    expect(await outbox.list()).toEqual([]);
  });

  it('requires a location', async () => {
    const r = await submitMemory(testServices(), USER, draft({ location: null }), newOutbox());
    expect(r).toEqual({ ok: false, error: 'Capture location before saving.' });
  });

  it('uploads the image and sets imageUrl', async () => {
    const s = testServices();
    const upload = jest.spyOn(s.repos.media, 'uploadMemoryImage').mockResolvedValue('https://img/1.jpg');
    const r = await submitMemory(s, USER, draft({ imageUri: 'file:///p.jpg' }), newOutbox(), identity);
    if (!r.ok || r.queued) throw new Error('expected an online save');
    expect(upload).toHaveBeenCalledWith({ userId: USER, memoryId: r.memoryId, localUri: 'file:///p.jpg' });
    const m = (await memoriesAt(s, r.placeId)).find((x) => x.id === r.memoryId);
    expect(m?.imageUrl).toBe('https://img/1.jpg');
  });

  it('uploads a voice note and sets audioUrl', async () => {
    const s = testServices();
    const upload = jest.spyOn(s.repos.media, 'uploadMemoryAudio').mockResolvedValue('https://audio/1.m4a');
    const r = await submitMemory(s, USER, draft({ audioUri: 'file:///v.m4a' }), newOutbox());
    if (!r.ok || r.queued) throw new Error('expected an online save');
    expect(upload).toHaveBeenCalledWith({ userId: USER, memoryId: r.memoryId, localUri: 'file:///v.m4a' });
    const m = (await memoriesAt(s, r.placeId)).find((x) => x.id === r.memoryId);
    expect(m?.audioUrl).toBe('https://audio/1.m4a');
  });

  it('reports a non-network upload failure, creates no memory and does not queue', async () => {
    const s = testServices();
    jest.spyOn(s.repos.media, 'uploadMemoryImage').mockRejectedValue(firestoreError('storage/unauthorized'));
    const create = jest.spyOn(s.repos.memories, 'create');
    const outbox = newOutbox();
    const r = await submitMemory(s, USER, draft({ imageUri: 'file:///p.jpg' }), outbox, identity);
    expect(r).toEqual({ ok: false, error: 'Photo upload failed. Try again or remove the photo.' });
    expect(create).not.toHaveBeenCalled();
    expect(await outbox.list()).toEqual([]);
  });

  it('queues the draft when the photo upload hits the retry limit', async () => {
    const s = testServices();
    jest
      .spyOn(s.repos.media, 'uploadMemoryImage')
      .mockRejectedValue(firestoreError('storage/retry-limit-exceeded'));
    const outbox = newOutbox();
    const r = await submitMemory(s, USER, draft({ imageUri: 'file:///p.jpg' }), outbox, identity);
    expect(r).toEqual({ ok: true, queued: true, memoryId: 'id-1' });
    const [queued] = await outbox.list();
    expect(queued!.imageUri).toBe('persisted://id-1.jpg');
  });

  it('queues the draft on a Firestore unavailable error', async () => {
    const s = testServices();
    jest.spyOn(s.repos.memories, 'create').mockRejectedValue(firestoreError('unavailable'));
    const outbox = newOutbox();
    const r = await submitMemory(s, USER, draft(), outbox);
    expect(r).toEqual({ ok: true, queued: true, memoryId: 'id-1' });
    expect((await outbox.list()).map((d) => d.memoryId)).toEqual(['id-1']);
  });

  it('maps an unknown backend error to generic copy, logs it and does not queue', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const s = testServices();
    jest.spyOn(s.repos.memories, 'create').mockRejectedValue(firestoreError('permission-denied'));
    const outbox = newOutbox();
    const r = await submitMemory(s, USER, draft(), outbox);
    expect(r).toEqual({ ok: false, error: 'Something went wrong. Please try again.' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(await outbox.list()).toEqual([]);
    warn.mockRestore();
  });

  describe('timeout', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('times out after 15 s with a connection error', async () => {
      // ADR-0006: the timed-out draft is queued instead of surfacing a connection error.
      const s = testServices();
      jest.spyOn(s.repos.memories, 'create').mockReturnValue(new Promise(() => {}));
      const outbox = newOutbox();
      const p = submitMemory(s, USER, draft(), outbox);
      await jest.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
      await expect(p).resolves.toEqual({ ok: true, queued: true, memoryId: 'id-1' });
      expect((await outbox.list()).map((d) => d.memoryId)).toEqual(['id-1']);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('drops the queued draft when the timed-out write finally lands', async () => {
      const s = testServices();
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const realCreate = s.repos.memories.create.bind(s.repos.memories);
      jest.spyOn(s.repos.memories, 'create').mockImplementation(async (m) => {
        await gate;
        return realCreate(m);
      });
      const outbox = newOutbox();
      const p = submitMemory(s, USER, draft(), outbox);
      await jest.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
      await expect(p).resolves.toMatchObject({ queued: true });
      expect(outbox.isInFlight('id-1')).toBe(true);
      release();
      await jest.advanceTimersByTimeAsync(0);
      expect(await outbox.list()).toEqual([]);
      expect(outbox.isInFlight('id-1')).toBe(false);
    });
  });
});

describe('prepareDraft', () => {
  it('fixes ids and createdAt and normalizes privacy fields', () => {
    const r = prepareDraft(testServices(), USER, draft({ taggedUserIds: ['x'], textContent: '  hi  ' }));
    expect(r).toEqual({
      ok: true,
      draft: {
        memoryId: 'id-1',
        placeIdIfNew: 'p_id-1',
        userId: USER,
        createdAt: TEST_NOW.toISOString(),
        textContent: 'hi',
        privacy: 'public',
        releaseDate: null,
        taggedUserIds: [],
        communityId: null,
        location: SEED_CENTER,
        imageUri: null,
        audioUri: null,
        sentiment: analyzeSentiment('hi'),
      },
    });
  });
});

describe('runDraft', () => {
  it('replay after partial success creates nothing twice', async () => {
    const s = testServices({ now: () => new Date('2026-12-01T00:00:00Z') });
    const d = outboxDraft({ location: QUEUED_FAR, imageUri: 'persisted://m1.jpg' });
    // First attempt got as far as the place and the photo before the connection dropped.
    const createPlace = jest.spyOn(s.repos.places, 'create');
    const createMemory = jest.spyOn(s.repos.memories, 'create').mockRejectedValueOnce(firestoreError('unavailable'));
    const upload = jest.spyOn(s.repos.media, 'uploadMemoryImage');
    await expect(runDraft(s, d)).rejects.toMatchObject({ code: 'unavailable' });
    expect(await s.repos.places.findById('p_m1')).not.toBeNull();

    const r = await runDraft(s, d);
    expect(r).toEqual({ memoryId: 'm1', placeId: 'p_m1' });
    expect(createPlace).toHaveBeenCalledTimes(1);
    expect(createMemory).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls.map(([i]) => i)).toEqual([
      { userId: USER, memoryId: 'm1', localUri: 'persisted://m1.jpg' },
      { userId: USER, memoryId: 'm1', localUri: 'persisted://m1.jpg' },
    ]);
    const memories = await memoriesAt(s, 'p_m1');
    expect(memories.map((m) => m.id)).toEqual(['m1']);
    expect(memories[0]!.createdAt.toISOString()).toBe('2026-10-18T09:00:00.000Z');
    const near = await new Promise<number>((resolve) =>
      s.repos.places.subscribeNearby({ center: QUEUED_FAR, radiusMeters: 1000 }, (ps) => resolve(ps.length))(),
    );
    expect(near).toBe(1);
  });

  it('does not recreate place p_<id> when it exists but is outside the match radius', async () => {
    const s = testServices();
    const d = outboxDraft({ location: QUEUED_FAR });
    await runDraft(s, d);
    const createPlace = jest.spyOn(s.repos.places, 'create');
    jest.spyOn(s.repos.places, 'findNearest').mockResolvedValue(null);
    await expect(runDraft(s, d)).resolves.toEqual({ memoryId: 'm1', placeId: 'p_m1' });
    expect(createPlace).not.toHaveBeenCalled();
  });
});

describe('runDraft over an existing memory', () => {
  async function signedIn() {
    const s = testServices();
    await s.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    return s;
  }

  it('writes nothing and returns the original place when findNearest now picks another', async () => {
    const s = await signedIn();
    const d = outboxDraft({ location: QUEUED_FAR });
    await runDraft(s, d);
    jest.spyOn(s.repos.places, 'findNearest').mockResolvedValue(await s.repos.places.findById('place-2'));
    const create = jest.spyOn(s.repos.memories, 'create');
    const createPlace = jest.spyOn(s.repos.places, 'create');
    await expect(runDraft(s, d)).resolves.toEqual({ memoryId: 'm1', placeId: 'p_m1' });
    expect(create).not.toHaveBeenCalled();
    expect(createPlace).not.toHaveBeenCalled();
  });

  it('does not restore a soft-deleted memory', async () => {
    const s = await signedIn();
    const d = outboxDraft({ imageUri: 'persisted://m1.jpg' });
    jest.spyOn(s.repos.media, 'uploadMemoryImage').mockResolvedValueOnce('').mockResolvedValue('https://img');
    await runDraft(s, d);
    await s.repos.memories.softDelete('m1', new Date('2026-10-18T10:00:00Z'));
    const attach = jest.spyOn(s.repos.memories, 'attachMedia');
    await runDraft(s, d);
    expect(await s.repos.memories.findById('m1')).toMatchObject({ isDeleted: true });
    expect(attach).not.toHaveBeenCalled();
  });

  it("keeps the user's later edit", async () => {
    const s = await signedIn();
    const d = outboxDraft();
    await runDraft(s, d);
    const edit = {
      textContent: 'edited later', privacy: 'private' as const, taggedUserIds: [], releaseDate: null, communityId: null,
      sentiment: { compound: 0, positive: 0, neutral: 1, negative: 0 },
    };
    await s.repos.memories.update('m1', edit, new Date('2026-10-18T11:00:00Z'));
    await runDraft(s, d);
    expect(await s.repos.memories.findById('m1')).toMatchObject(edit);
  });

  it('attaches media the existing memory is missing, without rewriting it', async () => {
    const s = await signedIn();
    await runDraft(s, outboxDraft());
    jest.spyOn(s.repos.media, 'uploadMemoryAudio').mockResolvedValue('https://audio/m1.m4a');
    const create = jest.spyOn(s.repos.memories, 'create');
    const attach = jest.spyOn(s.repos.memories, 'attachMedia');
    await runDraft(s, outboxDraft({ audioUri: 'persisted://m1.m4a' }));
    expect(create).not.toHaveBeenCalled();
    expect(attach).toHaveBeenCalledWith('m1', { audioUrl: 'https://audio/m1.m4a' }, TEST_NOW);
    expect(await s.repos.memories.findById('m1')).toMatchObject({ audioUrl: 'https://audio/m1.m4a' });
  });

  it('writes the sentiment stored in the draft, computing it for older drafts without one', async () => {
    const s = testServices();
    const stored = { compound: 0.9, positive: 0.9, neutral: 0.1, negative: 0 };
    await runDraft(s, outboxDraft({ sentiment: stored, location: QUEUED_FAR }));
    await runDraft(s, outboxDraft({ memoryId: 'm2', placeIdIfNew: 'p_m2', location: QUEUED_FAR }));
    const memories = await memoriesAt(s, 'p_m1');
    expect(memories.find((m) => m.id === 'm1')?.sentiment).toEqual(stored);
    expect(memories.find((m) => m.id === 'm2')?.sentiment).toEqual(analyzeSentiment('Queued memory'));
  });
});

describe('isPermanentError', () => {
  it.each([
    [firestoreError('permission-denied'), true],
    [firestoreError('invalid-argument'), true],
    [firestoreError('storage/unauthorized'), true],
    [firestoreError('storage/object-not-found'), true],
    [new Error('Photo is too large to upload.'), true],
    [firestoreError('unavailable'), false],
    [firestoreError('storage/retry-limit-exceeded'), false],
    [new TypeError('Network request failed'), false],
    [new Error('boom'), false],
  ])('%p -> %p', (e, expected) => {
    expect(isPermanentError(e)).toBe(expected);
  });

  it('looks through a wrapped media upload error', async () => {
    const s = testServices();
    jest.spyOn(s.repos.media, 'uploadMemoryImage').mockRejectedValue(firestoreError('storage/unauthorized'));
    const e = await runDraft(s, outboxDraft({ imageUri: 'persisted://m1.jpg' })).catch((x: unknown) => x);
    expect(isPermanentError(e)).toBe(true);
  });
});

describe('isNetworkError', () => {
  it.each([
    [firestoreError('unavailable'), true],
    [firestoreError('storage/retry-limit-exceeded'), true],
    [new TypeError('Network request failed'), true],
    [firestoreError('permission-denied'), false],
    [new TypeError('x is not a function'), false],
    [null, false],
  ])('%p -> %p', (e, expected) => {
    expect(isNetworkError(e)).toBe(expected);
  });
});
