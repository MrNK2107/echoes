import arJson from '../../../fixtures/domain/ar_scene.json';
import { mapArScene, rotateByHeading, smoothHeading } from './arScene';
import type { LatLng, Place } from './types';

interface Spec {
  id: string;
  latitude: number;
  longitude: number;
  intensity: number;
  publicMemoryCount: number;
}
interface Expected {
  placeId: string;
  eastMeters: number;
  northMeters: number;
  distanceMeters: number;
  bearingDegrees: number;
  sceneX: number;
  sceneZ: number;
  auraRadius: number;
  auraOpacity: number;
  visibleOrbCount: number;
}
interface ArCase {
  name: string;
  origin: LatLng;
  places: Spec[];
  expected: Expected[];
}

const cases = arJson as ArCase[];
const epoch = new Date(0);

function toPlace(s: Spec): Place {
  return {
    id: s.id,
    name: s.id,
    latitude: s.latitude,
    longitude: s.longitude,
    geohash: 'tdr1w',
    communityId: null,
    custodianIds: [],
    aura: {
      dominantSentiment: 'neutral',
      compoundScore: 0,
      intensity: s.intensity,
      memoryCount: 0,
      colorHex: '#888888',
      updatedAt: epoch,
    },
    memoryCount: s.publicMemoryCount,
    publicMemoryCount: s.publicMemoryCount,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

describe('mapArScene (golden fixtures)', () => {
  it.each(cases)('$name', (c) => {
    const out = mapArScene(c.origin, c.places.map(toPlace));
    expect(out.map((o) => o.placeId)).toEqual(c.expected.map((e) => e.placeId));
    c.expected.forEach((e, i) => {
      const o = out[i];
      if (!o) throw new Error('missing');
      expect(o.eastMeters).toBeCloseTo(e.eastMeters, 10);
      expect(o.northMeters).toBeCloseTo(e.northMeters, 10);
      expect(o.distanceMeters).toBeCloseTo(e.distanceMeters, 10);
      expect(o.bearingDegrees).toBeCloseTo(e.bearingDegrees, 10);
      expect(o.sceneX).toBeCloseTo(e.sceneX, 10);
      expect(o.sceneZ).toBeCloseTo(e.sceneZ, 10);
      expect(o.auraRadius).toBeCloseTo(e.auraRadius, 10);
      expect(o.auraOpacity).toBeCloseTo(e.auraOpacity, 10);
      expect(o.visibleOrbCount).toBe(e.visibleOrbCount);
    });
  });

  it('has at least 10 fixture cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(10);
  });

  it('origin case yields no NaN', () => {
    const c = cases.find((x) => x.name === 'origin');
    if (!c) throw new Error('no origin case');
    const [o] = mapArScene(c.origin, c.places.map(toPlace));
    for (const v of Object.values(o ?? {})) {
      if (typeof v === 'number') expect(Number.isNaN(v)).toBe(false);
    }
  });

  it('honours custom options', () => {
    const c = cases.find((x) => x.name.startsWith('8 places'));
    if (!c) throw new Error('missing');
    const out = mapArScene(c.origin, c.places.map(toPlace), { maxPlaces: 2 });
    expect(out).toHaveLength(2);
  });
});

describe('rotateByHeading', () => {
  it('heading 90 maps east to forward (-z)', () => {
    const r = rotateByHeading({ sceneX: 1, sceneZ: 0 }, 90);
    expect(r.x).toBeCloseTo(0, 10);
    expect(r.z).toBeCloseTo(-1, 10);
  });
  it('heading 0 keeps north (-z) forward', () => {
    const r = rotateByHeading({ sceneX: 0, sceneZ: -1 }, 0);
    expect(r.x).toBeCloseTo(0, 10);
    expect(r.z).toBeCloseTo(-1, 10);
  });
  it('heading 90 maps north to the left (-x)', () => {
    const r = rotateByHeading({ sceneX: 0, sceneZ: -1 }, 90);
    expect(r.x).toBeCloseTo(-1, 10);
    expect(r.z).toBeCloseTo(0, 10);
  });
  it('preserves magnitude', () => {
    const r = rotateByHeading({ sceneX: 3, sceneZ: -4 }, 123);
    expect(Math.hypot(r.x, r.z)).toBeCloseTo(5, 10);
  });
});

describe('smoothHeading', () => {
  it('returns normalised next when prev is null', () => {
    expect(smoothHeading(null, 45)).toBe(45);
    expect(smoothHeading(null, 365)).toBeCloseTo(5, 10);
  });
  it('350 -> 10 moves across 0, not via 180', () => {
    const r = smoothHeading(350, 10);
    expect(r).toBeCloseTo(354, 10);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(360);
  });
  it('wraps 359 toward 21 into [0, 360)', () => {
    const r = smoothHeading(359, 21, 0.5);
    expect(r).toBeCloseTo(10, 10);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(360);
  });
  it('moves counter-clockwise across 0', () => {
    expect(smoothHeading(10, 350)).toBeCloseTo(6, 10);
  });
  it('alpha 1 returns next, alpha 0 returns prev', () => {
    expect(smoothHeading(100, 200, 1)).toBeCloseTo(200, 10);
    expect(smoothHeading(100, 200, 0)).toBeCloseTo(100, 10);
  });
});
