import type { Firestore } from 'firebase/firestore';
import { COMMUNITY_IN_CHUNK, createMemoryRepository, timeReleaseBound } from './memories';

const mockInFilters: unknown[][] = [];
let mockQueryCount = 0;
type MockFilter = { field: string; op: string; value: unknown };
const mockQueries: MockFilter[][] = [];
const mockUpdates: unknown[] = [];
const mockListeners: ((snap: unknown) => void)[] = [];
let mockGetDoc: () => Promise<unknown> = async () => ({ id: 'x', data: () => undefined });

jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({}),
  setDoc: async () => {},
  getDoc: () => mockGetDoc(),
  updateDoc: async (_ref: unknown, data: unknown) => { mockUpdates.push(data); },
  serverTimestamp: () => 'SERVER_TIMESTAMP',
  limit: () => ({}),
  orderBy: () => ({}),
  query: (_c: unknown, ...constraints: unknown[]) => {
    mockQueryCount += 1;
    mockQueries.push(constraints.filter((c): c is MockFilter => typeof c === 'object' && c !== null && 'field' in c));
    return {};
  },
  where: (field: string, op: string, value: unknown) => {
    if (op === 'in') mockInFilters.push(value as unknown[]);
    return { field, op, value };
  },
  Timestamp: { fromDate: (d: Date) => d },
  onSnapshot: (_q: unknown, next: (snap: unknown) => void) => {
    mockListeners.push(next);
    return () => {};
  },
}));

describe('timeReleaseBound', () => {
  const clock = Date.parse('2026-10-18T12:00:00Z');
  it('is 5 minutes below the client clock when now is in the future', () => {
    expect(timeReleaseBound(new Date(clock + 86_400_000), clock).toISOString()).toBe('2026-10-18T11:55:00.000Z');
  });
  it('is 5 minutes below now when now is earlier than the client clock', () => {
    expect(timeReleaseBound(new Date('2026-06-01T00:00:00Z'), clock).toISOString()).toBe('2026-05-31T23:55:00.000Z');
  });
});

describe('community chunking', () => {
  it('chunks community ids into `in` queries of at most 10', () => {
    expect(COMMUNITY_IN_CHUNK).toBe(10);
    // Other tests in this file also build queries; count only this subscription's.
    mockInFilters.length = 0;
    mockQueryCount = 0;
    const communityIds = Array.from({ length: 25 }, (_, i) => `c${i}`);
    const repo = createMemoryRepository({} as Firestore);
    const unsub = repo.subscribeVisibleForPlace(
      { placeId: 'p', viewerId: 'v', viewerCommunityIds: communityIds, now: new Date() },
      () => {},
    );
    unsub();
    expect(mockInFilters.map((ids) => ids.length)).toEqual([10, 10, 5]);
    expect(mockInFilters.flat()).toEqual(communityIds);
    expect(mockQueryCount).toBe(4 + 3);
  });
});

describe('moderation (ADR-0008)', () => {
  it("every visibility branch except the viewer's own filters moderation == null", () => {
    mockQueries.length = 0;
    const unsub = createMemoryRepository({} as Firestore).subscribeVisibleForPlace(
      { placeId: 'p', viewerId: 'v', viewerCommunityIds: ['c1'], now: new Date() },
      () => {},
    );
    unsub();
    const moderated = (fs: MockFilter[]) =>
      fs.some((f) => f.field === 'moderation' && f.op === '==' && f.value === null);
    const own = mockQueries.filter((fs) => fs.some((f) => f.field === 'userId'));
    const others = mockQueries.filter((fs) => !fs.some((f) => f.field === 'userId'));
    expect(own).toHaveLength(1);
    expect(moderated(own[0])).toBe(false);
    expect(others).toHaveLength(4);
    expect(others.every(moderated)).toBe(true);
  });
});

describe('soft delete and restore (ruling R13)', () => {
  const T = new Date('2026-06-01T00:00:00Z');
  const stamp = (d: Date) => ({ toDate: () => d });
  /** A stored memory doc whose deletedAt is a pending server timestamp unless estimated. */
  function pendingDeleteDoc(opts?: { serverTimestamps?: string }) {
    const estimate = opts?.serverTimestamps === 'estimate' ? stamp(T) : null;
    return {
      userId: 'u', placeId: 'p', textContent: 't', latitude: 1, longitude: 2, geohash: 'g',
      sentiment: { compound: 0, positive: 0, neutral: 1, negative: 0 }, privacy: 'private',
      taggedUserIds: [], communityId: null, releaseDate: null, isDeleted: true,
      deletedAt: estimate, createdAt: stamp(T), updatedAt: estimate ?? stamp(T),
    };
  }
  const snapshotDoc = { id: 'm1', data: (opts?: { serverTimestamps?: string }) => pendingDeleteDoc(opts) };

  beforeEach(() => {
    mockUpdates.length = 0;
    mockListeners.length = 0;
  });

  it('softDelete stamps deletedAt and updatedAt with the server time, not the client clock', async () => {
    await createMemoryRepository({} as Firestore).softDelete('m1', new Date('2000-01-01T00:00:00Z'));
    expect(mockUpdates).toEqual([
      { isDeleted: true, deletedAt: 'SERVER_TIMESTAMP', updatedAt: 'SERVER_TIMESTAMP' },
    ]);
  });

  it('restore clears deletedAt and stamps updatedAt with the server time', async () => {
    await createMemoryRepository({} as Firestore).restore('m1', new Date('2000-01-01T00:00:00Z'));
    expect(mockUpdates).toEqual([{ isDeleted: false, deletedAt: null, updatedAt: 'SERVER_TIMESTAMP' }]);
  });

  it('findById estimates a pending server timestamp', async () => {
    mockGetDoc = async () => snapshotDoc;
    const m = await createMemoryRepository({} as Firestore).findById('m1');
    expect(m?.deletedAt).toEqual(T);
  });

  it.each(['subscribeDeletedForUser', 'subscribeForUser'] as const)(
    '%s estimates a pending server timestamp so a fresh delete is listed',
    (method) => {
      let got: { id: string; deletedAt: Date | null }[] = [];
      const unsub = createMemoryRepository({} as Firestore)[method]('u', (ms) => { got = ms; });
      for (const l of mockListeners) l({ docs: [snapshotDoc] });
      unsub();
      expect(got.map((m) => [m.id, m.deletedAt])).toEqual([['m1', T]]);
    },
  );
});
