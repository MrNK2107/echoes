import geohashJson from '../../../fixtures/domain/geohash.json';
import nearbyJson from '../../../fixtures/domain/nearby.json';
import {
  coveringPrefixes,
  distanceMeters,
  encodeGeohash,
  geohashRangeEnd,
  queryPrefixes,
} from './geo';

interface GeohashCase {
  latitude: number;
  longitude: number;
  precision: number;
  hash: string;
}
interface NearbyCase {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  precision: number;
  prefixes: string[];
}

describe('encodeGeohash', () => {
  it.each(geohashJson as GeohashCase[])(
    'encodes $latitude,$longitude at $precision',
    ({ latitude, longitude, precision, hash }) => {
      expect(encodeGeohash(latitude, longitude, precision)).toBe(hash);
    },
  );
});

describe('queryPrefixes', () => {
  it.each(nearbyJson as NearbyCase[])(
    'prefixes for $latitude,$longitude r=$radiusMeters',
    ({ latitude, longitude, radiusMeters, precision, prefixes }) => {
      const result = queryPrefixes({ latitude, longitude }, radiusMeters);
      expect(result).toEqual(prefixes);
      expect(result[0]?.length).toBe(precision);
    },
  );
});

describe('distanceMeters', () => {
  it('computes one degree of latitude', () => {
    expect(
      distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }),
    ).toBeCloseTo(111194.93, 1);
  });
  it('is zero for identical points', () => {
    const p = { latitude: 12.97, longitude: 77.59 };
    expect(distanceMeters(p, p)).toBe(0);
  });
});

describe('geohashRangeEnd', () => {
  it('sorts after any continuation including z', () => {
    expect(geohashRangeEnd('tdr1') > 'tdr1zzzz').toBe(true);
  });

  it('appends the U+F8FF sentinel', () => {
    expect(geohashRangeEnd('tdr1')).toBe('tdr1\uf8ff');
  });
});

describe('coveringPrefixes', () => {
  const center = { latitude: 12.9716, longitude: 77.5946 };
  const covered = (prefixes: string[], p: { latitude: number; longitude: number }) =>
    prefixes.some((x) => encodeGeohash(p.latitude, p.longitude).startsWith(x));

  it('covers a point 60 m away in a neighbouring cell that queryPrefixes misses', () => {
    const near = { latitude: center.latitude + 60 / 111195, longitude: center.longitude };
    expect(covered(queryPrefixes(center, 100), near)).toBe(false);
    expect(covered(coveringPrefixes(center, 100), near)).toBe(true);
  });

  it('covers every point on the radius circle for several radii', () => {
    for (const r of [50, 100, 500, 1500, 4000, 10000]) {
      const prefixes = coveringPrefixes(center, r);
      for (let deg = 0; deg < 360; deg += 15) {
        const a = (deg * Math.PI) / 180;
        const p = {
          latitude: center.latitude + (r * Math.cos(a)) / 111195,
          longitude: center.longitude + (r * Math.sin(a)) / (111195 * Math.cos((center.latitude * Math.PI) / 180)),
        };
        expect(covered(prefixes, p)).toBe(true);
      }
    }
  });

  it('includes the origin cell and has no redundant prefixes', () => {
    const prefixes = coveringPrefixes(center, 1500);
    expect(prefixes).toContain(queryPrefixes(center, 1500)[0]);
    for (const p of prefixes) {
      expect(prefixes.filter((q) => p.startsWith(q))).toEqual([p]);
    }
  });
});
