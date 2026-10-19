import {
  basisFromDeviceMotion,
  basisFromEuler,
  cameraElevation,
  cameraHeading,
  directionFor,
  layoutMarkers,
  project,
  relativeBearing,
  smoothBasis,
  type DeviceBasis,
} from './arProjection';

const HALF_PI = Math.PI / 2;
const VIEW = { width: 400, height: 800, verticalFovDegrees: 60 };
/** Portrait, back camera tilted up from the horizon by `tilt`, facing `heading`, screen rolled clockwise by `roll`. */
function upright(headingDegrees: number, tiltDegrees = 0, rollDegrees = 0): DeviceBasis {
  const b = basisFromEuler((-headingDegrees * Math.PI) / 180, HALF_PI + (tiltDegrees * Math.PI) / 180, 0);
  const r = (rollDegrees * Math.PI) / 180;
  // Rotate the screen axes about the camera axis.
  const mix = (u: readonly number[], v: readonly number[], cu: number, cv: number) =>
    [u[0]! * cu + v[0]! * cv, u[1]! * cu + v[1]! * cv, u[2]! * cu + v[2]! * cv] as const;
  return { x: mix(b.x, b.y, Math.cos(r), -Math.sin(r)), y: mix(b.x, b.y, Math.sin(r), Math.cos(r)), z: b.z };
}

const angleClose = (a: number, b: number) => expect(Math.abs(relativeBearing(a, b))).toBeLessThan(1e-6);

describe('arProjection', () => {
  it('gives an orthonormal right-handed basis', () => {
    const b = basisFromEuler(0.3, 1.1, -0.4);
    const len = (v: readonly number[]) => Math.hypot(v[0]!, v[1]!, v[2]!);
    expect(len(b.x)).toBeCloseTo(1);
    expect(len(b.y)).toBeCloseTo(1);
    expect(len(b.z)).toBeCloseTo(1);
    // x × y = z
    expect(b.x[1] * b.y[2] - b.x[2] * b.y[1]).toBeCloseTo(b.z[0]);
    expect(b.x[2] * b.y[0] - b.x[0] * b.y[2]).toBeCloseTo(b.z[1]);
    expect(b.x[0] * b.y[1] - b.x[1] * b.y[0]).toBeCloseTo(b.z[2]);
  });

  it('reads the camera heading and elevation of an upright phone', () => {
    for (const h of [0, 45, 90, 180, 270, 359]) {
      const b = upright(h);
      angleClose(cameraHeading(b), h);
      expect(cameraElevation(b)).toBeCloseTo(0);
    }
    expect(cameraElevation(upright(0, 20))).toBeCloseTo(20);
    expect(cameraElevation(upright(0, -30))).toBeCloseTo(-30);
  });

  it('points the camera at the floor when the phone lies flat', () => {
    expect(cameraElevation(basisFromEuler(0, 0, 0))).toBeCloseTo(-90);
  });

  it('keeps the heading stable through roll and through the upright gimbal pose', () => {
    // Euler angles are degenerate at beta = 90°: alpha and gamma trade off, the camera axis does not.
    angleClose(cameraHeading(basisFromEuler(-0.5, HALF_PI, 0)), cameraHeading(basisFromEuler(-0.2, HALF_PI, -0.3)));
    angleClose(cameraHeading(upright(120, 0, 25)), 120);
  });

  it('maps iOS CoreMotion (X north, Y west) onto the same world frame as Android', () => {
    // iOS yaw 0 upright: device X points north, so the back camera looks west.
    const ios = basisFromDeviceMotion({ alpha: 0, beta: HALF_PI, gamma: 0 }, 'ios');
    angleClose(cameraHeading(ios), 270);
    // iOS yaw grows counter-clockwise: +90° turns the camera from west to south.
    angleClose(cameraHeading(basisFromDeviceMotion({ alpha: HALF_PI, beta: HALF_PI, gamma: 0 }, 'ios')), 180);
    // Android alpha = -azimuth.
    angleClose(cameraHeading(basisFromDeviceMotion({ alpha: -HALF_PI, beta: HALF_PI, gamma: 0 }, 'android')), 90);
  });

  it('projects straight ahead to the centre and right-hand bearings to the right', () => {
    const b = upright(0);
    const centre = project(b, directionFor(0, 0), VIEW)!;
    expect(centre.x).toBeCloseTo(200);
    expect(centre.y).toBeCloseTo(400);
    const right = project(b, directionFor(10, 0), VIEW)!;
    expect(right.x).toBeGreaterThan(200);
    expect(right.y).toBeCloseTo(400);
    const above = project(b, directionFor(0, 10), VIEW)!;
    expect(above.y).toBeLessThan(400);
    // Half the vertical FOV up lands on the top edge.
    expect(project(b, directionFor(0, 30), VIEW)!.y).toBeCloseTo(0);
  });

  it('returns null for directions behind the camera', () => {
    expect(project(upright(0), directionFor(180, 0), VIEW)).toBeNull();
    expect(project(upright(0), directionFor(95, 0), VIEW)).toBeNull();
  });

  it('tilts the horizon with the phone roll', () => {
    const rolled = project(upright(0, 0, 20), directionFor(10, 0), VIEW)!;
    const level = project(upright(0), directionFor(10, 0), VIEW)!;
    expect(Math.abs(rolled.y - level.y)).toBeGreaterThan(5);
  });

  it('smooths towards the new pose and stays orthonormal', () => {
    const a = upright(0);
    const b = upright(40);
    const s = smoothBasis(a, b, 0.5);
    const h = cameraHeading(s);
    expect(h).toBeGreaterThan(5);
    expect(h).toBeLessThan(35);
    expect(Math.hypot(...s.x)).toBeCloseTo(1);
    expect(s.x[0] * s.z[0] + s.x[1] * s.z[1] + s.x[2] * s.z[2]).toBeCloseTo(0);
    expect(smoothBasis(null, b)).toBe(b);
    // A flip is taken as-is rather than averaged through zero.
    expect(smoothBasis(a, upright(180))).toEqual(upright(180));
  });

  describe('layoutMarkers', () => {
    const marker = (id: string, bearingDegrees: number, distanceMeters = 200, auraRadius = 3) => ({
      id,
      bearingDegrees,
      distanceMeters,
      auraRadius,
    });

    it('puts visible places on screen and the rest on the nearer edge', () => {
      const out = layoutMarkers(upright(0), [marker('a', 5), marker('b', 120), marker('c', 250)], VIEW);
      expect(out[0]).toMatchObject({ id: 'a', onScreen: true });
      expect(out[1]).toMatchObject({ id: 'b', onScreen: false, side: 'right' });
      expect(out[2]).toMatchObject({ id: 'c', onScreen: false, side: 'left' });
    });

    it('applies the magnetic declination', () => {
      // Sensor north is magnetic; a place at true bearing 10° with +10° declination is dead ahead.
      const [m] = layoutMarkers(upright(0), [marker('a', 10)], VIEW, { declinationDegrees: 10 });
      expect(m).toMatchObject({ onScreen: true });
      if (m!.onScreen) expect(m!.x).toBeCloseTo(200);
    });

    it('sizes nearer auras larger within the bounds', () => {
      const [near, far] = layoutMarkers(upright(0), [marker('n', -10, 20), marker('f', 10, 900)], VIEW);
      if (!near!.onScreen || !far!.onScreen) throw new Error('expected both on screen');
      expect(near!.size).toBeGreaterThan(far!.size);
      expect(near!.size).toBeLessThanOrEqual(140);
      expect(far!.size).toBeGreaterThanOrEqual(44);
    });

    it('pushes overlapping markers apart, nearest first', () => {
      const out = layoutMarkers(upright(0), [marker('far', 0, 600), marker('near', 0, 300), marker('mid', 0.5, 400)], VIEW);
      const on = out.filter((m): m is Extract<typeof m, { onScreen: true }> => m.onScreen);
      expect(on).toHaveLength(3);
      for (let i = 0; i < on.length; i++) {
        for (let j = i + 1; j < on.length; j++) {
          const a = on[i]!;
          const b = on[j]!;
          const overlap =
            Math.abs(a.x - b.x) < (a.size + b.size) / 2 && Math.abs(a.y - b.y) < (a.size + b.size) / 2;
          expect(overlap).toBe(false);
        }
      }
      const near = on.find((m) => m.id === 'near')!;
      expect(near.y).toBeLessThanOrEqual(400);
      expect(on.find((m) => m.id === 'far')!.y).toBeLessThan(near.y);
    });
  });
});
