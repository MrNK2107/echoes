import type { Firestore } from 'firebase/firestore';
import { COMMUNITY_IN_CHUNK, createMemoryRepository, timeReleaseBound } from './memories';

const mockInFilters: unknown[][] = [];
let mockQueryCount = 0;

jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({}),
  setDoc: async () => {},
  limit: () => ({}),
  orderBy: () => ({}),
  query: () => { mockQueryCount += 1; return {}; },
  where: (field: string, op: string, value: unknown) => {
    if (op === 'in') mockInFilters.push(value as unknown[]);
    return {};
  },
  Timestamp: { fromDate: (d: Date) => d },
  onSnapshot: () => () => {},
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
