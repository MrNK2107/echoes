import type { LatLng, Place } from './types';

export interface ArScenePlace {
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

export interface ArSceneOptions {
  maxPlaces?: number;
  maxOrbsPerPlace?: number;
  metersPerSceneUnit?: number;
  maxSceneDistance?: number;
}

const EARTH_RADIUS_METERS = 6371000;
const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

/** Ported from the Dart ArSceneMapper (equirectangular offset around the origin). */
export function mapArScene(
  origin: LatLng,
  places: Place[],
  opts: ArSceneOptions = {},
): ArScenePlace[] {
  const maxPlaces = opts.maxPlaces ?? 5;
  const maxOrbsPerPlace = opts.maxOrbsPerPlace ?? 8;
  const metersPerSceneUnit = opts.metersPerSceneUnit ?? 12;
  const maxSceneDistance = opts.maxSceneDistance ?? 24;

  const mapped = places.map((place): ArScenePlace => {
    const originLatRad = rad(origin.latitude);
    const latRad = rad(place.latitude);
    const averageLat = (originLatRad + latRad) / 2;
    const north = (latRad - originLatRad) * EARTH_RADIUS_METERS;
    const east =
      rad(place.longitude - origin.longitude) * EARTH_RADIUS_METERS * Math.cos(averageLat);
    const distance = Math.sqrt(east * east + north * north);
    const bearing = (deg(Math.atan2(east, north)) + 360) % 360;
    const rawX = east / metersPerSceneUnit;
    const rawZ = -north / metersPerSceneUnit;
    const sceneDistance = Math.sqrt(rawX * rawX + rawZ * rawZ);
    const scale = sceneDistance > maxSceneDistance ? maxSceneDistance / sceneDistance : 1;
    return {
      placeId: place.id,
      eastMeters: east,
      northMeters: north,
      distanceMeters: distance,
      bearingDegrees: bearing,
      sceneX: rawX * scale,
      sceneZ: rawZ * scale,
      auraRadius: 1.8 + place.aura.intensity * 3.2,
      auraOpacity: 0.18 + place.aura.intensity * 0.32,
      visibleOrbCount: Math.min(place.publicMemoryCount, maxOrbsPerPlace),
    };
  });
  mapped.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return mapped.slice(0, maxPlaces);
}

/**
 * Rotates scene coordinates (x east, z = -north) so the device heading
 * (degrees clockwise from north) points forward (-z).
 */
export function rotateByHeading(
  p: { sceneX: number; sceneZ: number },
  headingDegrees: number,
): { x: number; z: number } {
  const t = rad(headingDegrees);
  const east = p.sceneX;
  const north = -p.sceneZ;
  const right = east * Math.cos(t) - north * Math.sin(t);
  const forward = east * Math.sin(t) + north * Math.cos(t);
  return { x: right, z: -forward };
}

/** Shortest-arc exponential smoothing of a compass heading; result in [0, 360). */
export function smoothHeading(prev: number | null, next: number, alpha = 0.2): number {
  const norm = (d: number): number => ((d % 360) + 360) % 360;
  if (prev === null) return norm(next);
  const delta = ((((next - prev) % 360) + 540) % 360) - 180;
  return norm(prev + delta * alpha);
}
