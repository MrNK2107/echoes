import type { Memory, Place } from '@/domain/types';
import { emptyAura } from '@/domain/aura';
import type { ContractFactory } from './util';
import { waitFor } from './util';

const T = new Date('2026-01-01T00:00:00Z');
const NOW = new Date('2026-06-01T00:00:00Z');
const PLACE_ID = 'place-1';

function mkPlace(): Place {
  return {
    id: PLACE_ID, name: 'Spot', latitude: 12.97, longitude: 77.59, geohash: 'tdr1vz',
    communityId: null, custodianIds: ['custodian'], aura: emptyAura(T),
    memoryCount: 0, publicMemoryCount: 0, createdAt: T, updatedAt: T,
  };
}

let seq = 0;
function mem(over: Partial<Memory> = {}): Memory {
  seq += 1;
  const created = new Date(T.getTime() + seq * 1000);
  return {
    id: `m${seq}`, userId: 'author', placeId: PLACE_ID, imageUrl: null, audioUrl: null,
    textContent: 'a lovely day', latitude: 12.97, longitude: 77.59, geohash: 'tdr1vz',
    sentiment: { compound: 0.6, positive: 0.6, neutral: 0.4, negative: 0 },
    privacy: 'public', taggedUserIds: [], communityId: null, releaseDate: null,
    isDeleted: false, deletedAt: null, createdAt: created, updatedAt: created,
    ...over,
  };
}

export interface MemoryContractOptions {
  /**
   * Whether creating a memory updates the place's counts/aura. The Firestore backend relies on a
   * Cloud Function for this (Task 10); until then it passes `false` and the case is skipped.
   */
  supportsAggregation?: boolean;
}

export function memoryRepositoryContract(
  name: string,
  make: ContractFactory,
  options: MemoryContractOptions = {},
): void {
  const itAggregation = options.supportsAggregation === false ? it.skip : it;
  describe(`MemoryRepository contract: ${name}`, () => {
    let ctx: Awaited<ReturnType<ContractFactory>>;
    beforeEach(async () => {
      ctx = await make();
      await ctx.signInAs('custodian');
      await ctx.repos.places.create(mkPlace());
    });
    afterEach(async () => { await ctx.cleanup(); });

    async function visibleIds(viewerId: string, communityIds: string[] = []): Promise<string[]> {
      await ctx.signInAs(viewerId);
      let latest: Memory[] | null = null;
      const unsub = ctx.repos.memories.subscribeVisibleForPlace(
        { placeId: PLACE_ID, viewerId, viewerCommunityIds: communityIds, now: NOW },
        (ms) => { latest = ms; },
      );
      try {
        await waitFor(() => expect(latest).not.toBeNull());
        return ((latest as Memory[] | null) ?? []).map((m) => m.id);
      } finally {
        unsub();
      }
    }

    async function seed(...ms: Memory[]) {
      for (const m of ms) {
        await ctx.signInAs(m.userId);
        await ctx.repos.memories.create(m);
      }
    }

    it('viewer sees public plus own private, not another user private', async () => {
      const pub = mem({ userId: 'author' });
      const mine = mem({ userId: 'viewer', privacy: 'private' });
      const theirs = mem({ userId: 'author', privacy: 'private' });
      await seed(pub, mine, theirs);
      const ids = await visibleIds('viewer');
      expect(ids).toContain(pub.id);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(theirs.id);
    });

    it('tagged memories are visible only to the tagged viewer', async () => {
      const tagged = mem({ privacy: 'tagged', taggedUserIds: ['friend'] });
      await seed(tagged);
      expect(await visibleIds('friend')).toContain(tagged.id);
      expect(await visibleIds('stranger')).not.toContain(tagged.id);
    });

    it('timeRelease memories are hidden before releaseDate', async () => {
      const future = mem({ privacy: 'timeRelease', releaseDate: new Date('2027-01-01T00:00:00Z') });
      const past = mem({ privacy: 'timeRelease', releaseDate: new Date('2026-02-01T00:00:00Z') });
      await seed(future, past);
      const ids = await visibleIds('viewer');
      expect(ids).not.toContain(future.id);
      expect(ids).toContain(past.id);
    });

    it('returns newest first', async () => {
      const a = mem();
      const b = mem();
      const c = mem();
      await seed(a, b, c);
      expect(await visibleIds('viewer')).toEqual([c.id, b.id, a.id]);
    });

    it('returns at most 50', async () => {
      const ms = Array.from({ length: 55 }, () => mem());
      await seed(...ms);
      const ids = await visibleIds('viewer');
      expect(ids).toHaveLength(50);
      expect(ids[0]).toBe(ms[54]!.id);
    });

    itAggregation('creating a public memory increases place counts and aura.memoryCount by 1', async () => {
      const before = await ctx.repos.places.findById(PLACE_ID);
      expect(before).not.toBeNull();
      await seed(mem());
      await waitFor(async () => {
        const after = await ctx.repos.places.findById(PLACE_ID);
        expect(after?.memoryCount).toBe(before!.memoryCount + 1);
        expect(after?.publicMemoryCount).toBe(before!.publicMemoryCount + 1);
        expect(after?.aura.memoryCount).toBe(before!.aura.memoryCount + 1);
      });
    });
  });
}
