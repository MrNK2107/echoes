/**
 * Location-based camera AR (ADR-0010, amended). The phone's attitude comes from the fused
 * rotation sensor as W3C DeviceOrientation Euler angles (Z-X'-Y'', radians) in an
 * East-North-Up world frame; places are projected onto the camera preview by bearing,
 * distance and a pinhole camera model. Everything here is pure so it is unit tested.
 */

export type Vec3 = readonly [number, number, number];

/** The device axes expressed in world (East, North, Up) coordinates. */
export interface DeviceBasis {
  /** Device +X: out of the right edge of the screen. */
  x: Vec3;
  /** Device +Y: out of the top edge of the screen. */
  y: Vec3;
  /** Device +Z: out of the screen towards the viewer; the back camera looks along -Z. */
  z: Vec3;
}

export interface Viewport {
  width: number;
  height: number;
  /** Vertical field of view of the preview across `height`, in degrees. */
  verticalFovDegrees: number;
}

export interface Projected {
  x: number;
  y: number;
  /** Distance along the camera axis in view units (> 0 when in front of the camera). */
  depth: number;
}

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm360 = (d: number): number => ((d % 360) + 360) % 360;

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** R = Rz(alpha) · Rx(beta) · Ry(gamma); the columns are the device axes in world coordinates. */
export function basisFromEuler(alpha: number, beta: number, gamma: number): DeviceBasis {
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);
  const cb = Math.cos(beta);
  const sb = Math.sin(beta);
  const cg = Math.cos(gamma);
  const sg = Math.sin(gamma);
  return {
    x: [ca * cg - sa * sb * sg, sa * cg + ca * sb * sg, -cb * sg],
    y: [-sa * cb, ca * cb, sb],
    z: [ca * sg + sa * sb * cg, sa * sg - ca * sb * cg, cb * cg],
  };
}

/**
 * expo-sensors `DeviceMotion.rotation` to a world basis. Android already reports W3C angles
 * (alpha = -azimuth from the rotation vector). iOS reports CoreMotion yaw/pitch/roll in the
 * xMagneticNorthZVertical frame (X = north, Y = west), which is the W3C frame turned by 90°.
 */
export function basisFromDeviceMotion(
  rotation: { alpha: number; beta: number; gamma: number },
  platform: 'ios' | 'android',
): DeviceBasis {
  const alpha = platform === 'ios' ? rotation.alpha + Math.PI / 2 : rotation.alpha;
  return basisFromEuler(alpha, rotation.beta, rotation.gamma);
}

/** Exponential smoothing of the camera attitude, re-orthonormalised so the basis stays a rotation. */
export function smoothBasis(prev: DeviceBasis | null, next: DeviceBasis, alpha = 0.25): DeviceBasis {
  if (!prev) return next;
  const mix = (a: Vec3, b: Vec3): Vec3 => [a[0] + (b[0] - a[0]) * alpha, a[1] + (b[1] - a[1]) * alpha, a[2] + (b[2] - a[2]) * alpha];
  // A near-180° flip between samples (sensor reset) cannot be interpolated; take the new pose.
  if (dot(prev.z, next.z) < 0 || dot(prev.y, next.y) < 0) return next;
  const z = normalize(mix(prev.z, next.z));
  const x = normalize(cross(mix(prev.y, next.y), z));
  const y = cross(z, x);
  return { x, y, z };
}

/** Compass heading (degrees clockwise from the sensor's north) the back camera points at. */
export function cameraHeading(b: DeviceBasis): number {
  return norm360(deg(Math.atan2(-b.z[0], -b.z[1])));
}

/** Angle of the camera axis above (+) or below (-) the horizon, in degrees. */
export function cameraElevation(b: DeviceBasis): number {
  return deg(Math.asin(Math.max(-1, Math.min(1, -b.z[2]))));
}

/** World direction (East, North, Up) for a compass bearing and elevation in degrees. */
export function directionFor(bearingDegrees: number, elevationDegrees: number): Vec3 {
  const b = rad(bearingDegrees);
  const e = rad(elevationDegrees);
  return [Math.sin(b) * Math.cos(e), Math.cos(b) * Math.cos(e), Math.sin(e)];
}

/** Pinhole projection; null when the direction is behind (or nearly perpendicular to) the camera. */
export function project(b: DeviceBasis, direction: Vec3, viewport: Viewport): Projected | null {
  const forward = -dot(direction, b.z);
  if (forward < 0.05) return null;
  const focal = viewport.height / 2 / Math.tan(rad(viewport.verticalFovDegrees) / 2);
  return {
    x: viewport.width / 2 + (focal * dot(direction, b.x)) / forward,
    y: viewport.height / 2 - (focal * dot(direction, b.y)) / forward,
    depth: forward,
  };
}

/** Signed shortest-arc difference target - from, in (-180, 180]. */
export function relativeBearing(from: number, target: number): number {
  const d = norm360(target - from);
  return d > 180 ? d - 360 : d;
}

/** Markers float a little above eye level so near places sit higher and stacks fan out. */
export const ANCHOR_ABOVE_EYE_METERS = 1.5;
const MIN_ANCHOR_DISTANCE = 4;

export function anchorElevation(distanceMeters: number): number {
  return deg(Math.atan2(ANCHOR_ABOVE_EYE_METERS, Math.max(distanceMeters, MIN_ANCHOR_DISTANCE)));
}

export interface ArMarkerInput {
  id: string;
  /** Degrees clockwise from true north. */
  bearingDegrees: number;
  distanceMeters: number;
  /** Aura radius in scene units from `mapArScene` (1.8 to 5.0). */
  auraRadius: number;
}

export type ArMarker =
  | { id: string; onScreen: true; x: number; y: number; size: number }
  | { id: string; onScreen: false; side: 'left' | 'right'; offsetDegrees: number };

export interface MarkerLayoutOptions {
  /** True heading minus magnetic heading; the rotation sensor references magnetic north. */
  declinationDegrees?: number;
  minSize?: number;
  maxSize?: number;
  /** Markers whose centre is this far outside the viewport count as off-screen. */
  margin?: number;
  /** Extra gap kept between neighbouring markers (room for orbs and labels). */
  padding?: number;
}

/** Aura in metres in the world: scene radius times this factor. */
const AURA_WORLD_METERS_PER_UNIT = 3;

/**
 * Places each marker on the camera preview, or on the left/right edge when it is out of view.
 * Overlapping on-screen markers are pushed apart vertically, nearest first, so every target
 * stays tappable.
 */
export function layoutMarkers(
  basis: DeviceBasis,
  markers: ArMarkerInput[],
  viewport: Viewport,
  opts: MarkerLayoutOptions = {},
): ArMarker[] {
  const declination = opts.declinationDegrees ?? 0;
  const minSize = opts.minSize ?? 44;
  const maxSize = opts.maxSize ?? 140;
  const margin = opts.margin ?? 0;
  const padding = opts.padding ?? 4;
  const focal = viewport.height / 2 / Math.tan(rad(viewport.verticalFovDegrees) / 2);
  const heading = cameraHeading(basis);

  const placed: { m: ArMarker & { onScreen: true }; distance: number }[] = [];
  const out: ArMarker[] = markers.map((m): ArMarker => {
    const magneticBearing = m.bearingDegrees - declination;
    const p = project(basis, directionFor(magneticBearing, anchorElevation(m.distanceMeters)), viewport);
    const inside =
      p && p.x >= -margin && p.x <= viewport.width + margin && p.y >= -margin && p.y <= viewport.height + margin;
    if (!p || !inside) {
      const offset = relativeBearing(heading, magneticBearing);
      return { id: m.id, onScreen: false, side: offset < 0 ? 'left' : 'right', offsetDegrees: offset };
    }
    const worldRadius = m.auraRadius * AURA_WORLD_METERS_PER_UNIT;
    const size = Math.max(minSize, Math.min(maxSize, (2 * focal * worldRadius) / Math.max(m.distanceMeters, 1)));
    const marker = { id: m.id, onScreen: true as const, x: p.x, y: p.y, size };
    placed.push({ m: marker, distance: m.distanceMeters });
    return marker;
  });

  // Nearest markers keep their place; farther ones move up until they no longer overlap.
  placed.sort((a, b) => a.distance - b.distance);
  for (let i = 1; i < placed.length; i++) {
    const cur = placed[i]!.m;
    for (let guard = 0; guard < placed.length; guard++) {
      const hit = placed
        .slice(0, i)
        .map((p) => p.m)
        .find((o) => {
          const reach = (o.size + cur.size) / 2 + padding;
          return Math.abs(o.x - cur.x) < reach && Math.abs(o.y - cur.y) < reach;
        });
      if (!hit) break;
      cur.y = hit.y - (hit.size + cur.size) / 2 - padding;
    }
  }
  return out;
}
