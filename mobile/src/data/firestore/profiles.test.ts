import type { Firestore } from 'firebase/firestore';
import { createProfileRepository } from './profiles';

const mockLimits: number[] = [];
const mockInSizes: number[] = [];
let mockQueryLimits: (number | null)[] = [];

jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({}),
  documentId: () => '__name__',
  getDoc: async () => ({ id: 'x', data: () => undefined }),
  getDocs: async () => ({ docs: [] }),
  setDoc: async () => {},
  updateDoc: async () => {},
  limit: (n: number) => {
    mockLimits.push(n);
    return { limit: n };
  },
  where: (field: string, op: string, value: unknown) => {
    if (op === 'in') mockInSizes.push((value as unknown[]).length);
    return { field, op, value };
  },
  query: (_c: unknown, ...constraints: { limit?: number }[]) => {
    mockQueryLimits.push(constraints.find((c) => c.limit !== undefined)?.limit ?? null);
    return {};
  },
}));
jest.mock('firebase/auth', () => ({ updateProfile: async () => {} }));

beforeEach(() => {
  mockLimits.length = 0;
  mockInSizes.length = 0;
  mockQueryLimits = [];
});

describe('publicProfiles list queries carry limit <= 30 (rules, Plan 5)', () => {
  it('getMany limits each `in` chunk to its own size', async () => {
    const repo = createProfileRepository({} as Firestore);
    const ids = Array.from({ length: 65 }, (_, i) => `u${i}`);
    await repo.getMany(ids);
    expect(mockInSizes).toEqual([30, 30, 5]);
    expect(mockQueryLimits).toEqual([30, 30, 5]);
  });

  it('search limits the page', async () => {
    const repo = createProfileRepository({} as Firestore);
    await repo.search('zo', { excludeUid: 'me' });
    expect(mockQueryLimits).toEqual([11]);
    expect(Math.max(...mockQueryLimits.filter((n): n is number => n !== null))).toBeLessThanOrEqual(30);
  });
});
