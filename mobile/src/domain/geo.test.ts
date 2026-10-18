import geohashJson from '../../../fixtures/domain/geohash.json';
import nearbyJson from '../../../fixtures/domain/nearby.json';
import {
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
});
