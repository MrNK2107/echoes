import type { LatLng } from './types';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const EARTH_RADIUS_METERS = 6371000;

export function encodeGeohash(lat: number, lng: number, precision = 9): string {
  let isEven = true;
  let bit = 0;
  let charIndex = 0;
  let hash = '';
  const latRange = [-90, 90];
  const lngRange = [-180, 180];

  while (hash.length < precision) {
    const range = isEven ? lngRange : latRange;
    const value = isEven ? lng : lat;
    const midpoint = ((range[0] ?? 0) + (range[1] ?? 0)) / 2;
    if (value >= midpoint) {
      charIndex = (charIndex << 1) + 1;
      range[0] = midpoint;
    } else {
      charIndex <<= 1;
      range[1] = midpoint;
    }
    isEven = !isEven;
    if (++bit === 5) {
      hash += BASE32[charIndex];
      bit = 0;
      charIndex = 0;
    }
  }
  return hash;
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function geohashPrecisionFor(radiusMeters: number): number {
  if (radiusMeters <= 100) return 7;
  if (radiusMeters <= 500) return 6;
  if (radiusMeters <= 4000) return 5;
  return 4;
}

// Approximate cell width at the equator for each geohash precision (1..10).
const CELL_WIDTHS = [5000000, 1250000, 156000, 39000, 4900, 610, 76, 19, 4.8, 0.6];

function cellWidthMeters(precision: number): number {
  const index = Math.min(Math.max(precision - 1, 0), CELL_WIDTHS.length - 1);
  return CELL_WIDTHS[index] ?? 0;
}

const NEIGHBOR_SUFFIXES = ['', ...BASE32.split('')];

export function queryPrefixes(origin: LatLng, radiusMeters: number): string[] {
  const hash = encodeGeohash(origin.latitude, origin.longitude);
  const prefixLength = geohashPrecisionFor(radiusMeters);
  const prefix = hash.substring(0, prefixLength);
  if (radiusMeters <= cellWidthMeters(prefixLength) * 1.5) return [prefix];
  return NEIGHBOR_SUFFIXES.map((s) => prefix + s);
}

/** Exclusive-style upper bound for a prefix range query; covers continuations ending in 'z'. */
export function geohashRangeEnd(prefix: string): string {
  return `${prefix}`;
}
