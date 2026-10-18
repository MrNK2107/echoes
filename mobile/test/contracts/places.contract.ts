import type { Place } from '@/domain/types';
import { emptyAura } from '@/domain/aura';
import { encodeGeohash, queryPrefixes } from '@/domain/geo';
import type { ContractFactory } from './util';
import { waitFor } from './util';

const CENTER = { latitude: 12.9716, longitude: 77.5946 };
const M_PER_DEG_LAT = 111_195;
const at = (meters: number) => ({
  latitude: CENTER.latitude + meters / M_PER_DEG_LAT,
  longitude: CENTER.longitude,
});
const T = new Date('2026-01-01T00:00:00Z');
/** Places are created by this user; real backends require the creator to be a custodian. */
const CUSTODIAN = 'custodian';
/** A point whose 9-char geohash continues the 100 m query prefix with 'z' (tdr1v95 + z…). */
const Z_POINT = { latitude: 12.97057, longitude: 77.59063 };

function placeAt(id: string, p: { latitude: number; longitude: number }): Place {
  return {
    id, name: 'Memory Place', latitude: p.latitude, longitude: p.longitude,
    geohash: encodeGeohash(p.latitude, p.longitude),
    communityId: null, custodianIds: [CUSTODIAN], aura: emptyAura(T),
    memoryCount: 0, publicMemoryCount: 0, createdAt: T, updatedAt: T,
  };
}

function place(id: string, meters: number): Place {
  return placeAt(id, at(meters));
}

export function placeRepositoryContract(name: string, make: ContractFactory): void {
  describe(`PlaceRepository contract: ${name}`, () => {
    let ctx: Awaited<ReturnType<ContractFactory>>;
    beforeEach(async () => {
      ctx = await make();
      await ctx.signInAs(CUSTODIAN);
    });
    afterEach(async () => { await ctx.cleanup(); });

    it('findById returns created place or null', async () => {
      await ctx.repos.places.create(place('a', 0));
      expect((await ctx.repos.places.findById('a'))?.id).toBe('a');
      expect(await ctx.repos.places.findById('nope')).toBeNull();
    });

    it('findNearest returns the place 60 m away', async () => {
      await ctx.repos.places.create(place('near', 60));
      expect((await ctx.repos.places.findNearest({ center: CENTER, radiusMeters: 100 }))?.id).toBe('near');
    });

    it('findNearest returns null for a place 150 m away (radius 100)', async () => {
      await ctx.repos.places.create(place('far', 150));
      expect(await ctx.repos.places.findNearest({ center: CENTER, radiusMeters: 100 })).toBeNull();
    });

    it('finds a place whose geohash continues with z', async () => {
      const zPlace = placeAt('zed', Z_POINT);
      const [prefix] = queryPrefixes(Z_POINT, 100);
      expect(zPlace.geohash.startsWith(`${prefix}z`)).toBe(true);
      await ctx.repos.places.create(zPlace);
      expect((await ctx.repos.places.findNearest({ center: Z_POINT, radiusMeters: 100 }))?.id).toBe('zed');
      let latest: string[] = [];
      const unsub = ctx.repos.places.subscribeNearby(
        { center: Z_POINT, radiusMeters: 100 },
        (ps) => { latest = ps.map((p) => p.id); },
      );
      try {
        await waitFor(() => expect(latest).toEqual(['zed']));
      } finally {
        unsub();
      }
    });

    it('subscribeNearby emits within 1500 m sorted by distance, excludes 2 km, re-emits after create', async () => {
      await ctx.repos.places.create(place('p1000', 1000));
      await ctx.repos.places.create(place('p200', 200));
      await ctx.repos.places.create(place('p2000', 2000));
      let latest: string[] = [];
      const unsub = ctx.repos.places.subscribeNearby(
        { center: CENTER, radiusMeters: 1500 },
        (ps) => { latest = ps.map((p) => p.id); },
      );
      try {
        await waitFor(() => expect(latest).toEqual(['p200', 'p1000']));
        await ctx.repos.places.create(place('p500', 500));
        await waitFor(() => expect(latest).toEqual(['p200', 'p500', 'p1000']));
      } finally {
        unsub();
      }
    });
  });
}
