import { SEED_CENTER, testServices } from '@/device/fakes';
import { analyzeSentiment } from '@/domain/sentiment';
import type { Memory } from '@/domain/types';

import type { MemoryDraft } from './submitMemory';
import { submitMemory, SUBMIT_TIMEOUT_MS } from './submitMemory';

const draft = (o: Partial<MemoryDraft> = {}): MemoryDraft => ({
  textContent: 'A lovely quiet morning',
  privacy: 'public',
  releaseDate: null,
  taggedUserIds: [],
  communityId: null,
  location: SEED_CENTER,
  imageUri: null,
  ...o,
});
const USER = 'user-demo';

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

describe('submitMemory', () => {
  it('creates a new place when none is within 100 m', async () => {
    const s = testServices();
    const far = { latitude: 13.5, longitude: 78.5 };
    const r = await submitMemory(s, USER, draft({ location: far }));
    if (!r.ok) throw new Error(r.error);
    const place = await s.repos.places.findById(r.placeId);
    expect(place?.name).toBe('Memory Place');
    expect(place?.custodianIds).toEqual([USER]);
  });

  it('reuses the seeded place 40 m away', async () => {
    const s = testServices();
    const seeded = await s.repos.places.findById('place-2');
    if (!seeded) throw new Error('seed missing');
    const near = { latitude: seeded.latitude + 0.00036, longitude: seeded.longitude };
    const r = await submitMemory(s, USER, draft({ location: near }));
    if (!r.ok) throw new Error(r.error);
    expect(r.placeId).toBe('place-2');
  });

  it('stores sentiment from the text', async () => {
    const s = testServices();
    const r = await submitMemory(s, USER, draft({ textContent: '  I love this wonderful place  ' }));
    if (!r.ok) throw new Error(r.error);
    const m = (await memoriesAt(s, r.placeId)).find((x) => x.id === r.memoryId);
    expect(m?.sentiment).toEqual(analyzeSentiment('I love this wonderful place'));
    expect(m?.textContent).toBe('I love this wonderful place');
  });

  it('rejects whitespace-only text', async () => {
    const r = await submitMemory(testServices(), USER, draft({ textContent: '   ' }));
    expect(r).toEqual({ ok: false, error: 'Write something to remember.' });
  });

  it('rejects text over 2000 characters', async () => {
    const r = await submitMemory(testServices(), USER, draft({ textContent: 'a'.repeat(2001) }));
    expect(r).toEqual({ ok: false, error: 'Memories can be at most 2000 characters.' });
  });

  it('rejects a time release in the past', async () => {
    const r = await submitMemory(
      testServices(),
      USER,
      draft({ privacy: 'timeRelease', releaseDate: new Date('2020-01-01') }),
    );
    expect(r).toEqual({ ok: false, error: 'Choose a future release date.' });
  });

  it('requires a location', async () => {
    const r = await submitMemory(testServices(), USER, draft({ location: null }));
    expect(r).toEqual({ ok: false, error: 'Capture location before saving.' });
  });

  it('uploads the image and sets imageUrl', async () => {
    const s = testServices();
    const upload = jest.spyOn(s.repos.media, 'uploadMemoryImage').mockResolvedValue('https://img/1.jpg');
    const r = await submitMemory(s, USER, draft({ imageUri: 'file:///p.jpg' }), { compress: async (u) => u });
    if (!r.ok) throw new Error(r.error);
    expect(upload).toHaveBeenCalledWith({ userId: USER, memoryId: r.memoryId, localUri: 'file:///p.jpg' });
    const m = (await memoriesAt(s, r.placeId)).find((x) => x.id === r.memoryId);
    expect(m?.imageUrl).toBe('https://img/1.jpg');
  });

  it('reports upload failure and creates no memory', async () => {
    const s = testServices();
    jest.spyOn(s.repos.media, 'uploadMemoryImage').mockRejectedValue(new Error('boom'));
    const create = jest.spyOn(s.repos.memories, 'create');
    const r = await submitMemory(s, USER, draft({ imageUri: 'file:///p.jpg' }), { compress: async (u) => u });
    expect(r).toEqual({ ok: false, error: 'Photo upload failed. Try again or remove the photo.' });
    expect(create).not.toHaveBeenCalled();
  });

  describe('timeout', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('times out after 15 s with a connection error', async () => {
      const s = testServices();
      jest.spyOn(s.repos.memories, 'create').mockReturnValue(new Promise(() => {}));
      const p = submitMemory(s, USER, draft());
      await jest.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
      await expect(p).resolves.toEqual({
        ok: false,
        error: 'Could not reach the server. Check your connection and try again.',
      });
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
