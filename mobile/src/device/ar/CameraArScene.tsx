import { memo, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import {
  basisFromDeviceMotion,
  layoutMarkers,
  smoothBasis,
  type ArMarker,
  type DeviceBasis,
  type Viewport,
} from '@/domain/arProjection';
import { orbLabel, truncateName } from '@/ui/arLabels';
import { AR_CAMERA_HINT } from '@/ui/copy';
import { formatDistance } from '@/ui/format';
import { colors } from '@/ui/theme';

import type { ArSceneProps } from '../types';

export interface MotionRotation {
  alpha: number;
  beta: number;
  gamma: number;
}

/** Native pieces the scene needs, injected so the scene is testable without a camera or sensors. */
export interface CameraArDeps {
  CameraView: ComponentType<{
    style?: StyleProp<ViewStyle>;
    facing?: 'back' | 'front';
    animateShutter?: boolean;
    onMountError?: (event: { message: string }) => void;
  }>;
  /** Starts attitude updates; returns the unsubscribe function. */
  subscribeMotion(cb: (rotation: MotionRotation) => void): () => void;
  platform: 'ios' | 'android';
  /** True minus magnetic heading in degrees; 0 when unknown. */
  declination(): Promise<number>;
}

/**
 * Vertical field of view of a typical phone main camera across the long side of the sensor. The
 * portrait preview fills its view in cover mode, so this spans the view's height. Real lenses range
 * from about 55° to 70°; the error shows as a small drift of markers away from the centre.
 */
export const VERTICAL_FOV_DEGREES = 62;
/** Without a first attitude sample in this time the scene gives up and the screen shows the radar. */
export const MOTION_TIMEOUT_MS = 3000;
const ORB_DOT = 14;
const ORB_HIT = 32;
const ORB_GAP = 8;
const LABEL_HEIGHT = 34;
const EDGE_TOP = 0.3;
const EDGE_STEP = 56;
/** Skip re-renders for sub-pixel pose changes. */
const MIN_AXIS_CHANGE = 0.0015;

function changed(a: DeviceBasis | null, b: DeviceBasis): boolean {
  if (!a) return true;
  for (const k of ['x', 'y', 'z'] as const) {
    for (let i = 0; i < 3; i++) if (Math.abs(a[k][i]! - b[k][i]!) > MIN_AXIS_CHANGE) return true;
  }
  return false;
}

export function createCameraArScene(deps: CameraArDeps): ComponentType<ArSceneProps> {
  const { CameraView } = deps;

  function CameraArSceneView({ places, onPressPlace, onPressOrb, onTrackingError }: ArSceneProps) {
    const [viewport, setViewport] = useState<Viewport | null>(null);
    const [basis, setBasis] = useState<DeviceBasis | null>(null);
    const [declination, setDeclination] = useState(0);
    const errorRef = useRef(onTrackingError);
    const failed = useRef(false);

    useEffect(() => {
      errorRef.current = onTrackingError;
    });

    const fail = () => {
      if (failed.current) return;
      failed.current = true;
      errorRef.current();
    };

    useEffect(() => {
      let active = true;
      deps.declination().then(
        (d) => {
          if (active && Number.isFinite(d)) setDeclination(d);
        },
        () => {},
      );
      return () => {
        active = false;
      };
    }, []);

    useEffect(() => {
      let smoothed: DeviceBasis | null = null;
      let shown: DeviceBasis | null = null;
      let first = true;
      const timer = setTimeout(fail, MOTION_TIMEOUT_MS);
      let off: (() => void) | null = null;
      try {
        off = deps.subscribeMotion((rotation) => {
          if (![rotation.alpha, rotation.beta, rotation.gamma].every(Number.isFinite)) return;
          if (first) {
            first = false;
            clearTimeout(timer);
          }
          smoothed = smoothBasis(smoothed, basisFromDeviceMotion(rotation, deps.platform));
          if (!changed(shown, smoothed)) return;
          shown = smoothed;
          setBasis(smoothed);
        });
      } catch {
        clearTimeout(timer);
        fail();
      }
      return () => {
        clearTimeout(timer);
        off?.();
      };
    }, []);

    const onLayout = (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      if (width > 0 && height > 0) setViewport({ width, height, verticalFovDegrees: VERTICAL_FOV_DEGREES });
    };

    return (
      <View style={styles.container} onLayout={onLayout} testID="camera-ar">
        <CameraView style={StyleSheet.absoluteFill} facing="back" animateShutter={false} onMountError={fail} />
        {viewport && basis ? (
          <Overlay
            places={places}
            basis={basis}
            viewport={viewport}
            declination={declination}
            onPressPlace={onPressPlace}
            onPressOrb={onPressOrb}
          />
        ) : null}
      </View>
    );
  }

  return CameraArSceneView;
}

type OverlayProps = Pick<ArSceneProps, 'places' | 'onPressPlace' | 'onPressOrb'> & {
  basis: DeviceBasis;
  viewport: Viewport;
  declination: number;
};

const Overlay = memo(function Overlay({ places, basis, viewport, declination, onPressPlace, onPressOrb }: OverlayProps) {
  const markers = layoutMarkers(
    basis,
    places.map((p) => ({ id: p.placeId, bearingDegrees: p.bearingDegrees, distanceMeters: p.distanceMeters, auraRadius: p.auraRadius })),
    viewport,
    { declinationDegrees: declination, padding: ORB_GAP + ORB_HIT + LABEL_HEIGHT / 2 },
  );
  const byId = new Map(places.map((p) => [p.placeId, p]));
  const onScreen = markers.filter((m): m is Extract<ArMarker, { onScreen: true }> => m.onScreen);
  const edge = { left: 0, right: 0 };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {onScreen.length === 0 ? (
        <Text style={styles.hint} pointerEvents="none">
          {AR_CAMERA_HINT}
        </Text>
      ) : null}
      {/* Farthest first so nearer auras draw (and take taps) on top. */}
      {[...onScreen]
        .sort((a, b) => byId.get(b.id)!.distanceMeters - byId.get(a.id)!.distanceMeters)
        .map((m) => {
          const p = byId.get(m.id)!;
          const ring = m.size / 2 + ORB_GAP + ORB_HIT / 2;
          return (
            <View key={m.id} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
              <Pressable
                testID={`ar-place-${m.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}, ${formatDistance(p.distanceMeters)}`}
                onPress={() => onPressPlace(m.id)}
                style={[
                  styles.aura,
                  {
                    left: m.x - m.size / 2,
                    top: m.y - m.size / 2,
                    width: m.size,
                    height: m.size,
                    borderRadius: m.size / 2,
                    backgroundColor: p.color,
                    opacity: Math.min(0.9, p.auraOpacity + 0.3),
                    shadowColor: p.color,
                  },
                ]}
              />
              <View pointerEvents="none" style={[styles.label, { left: m.x - 70, top: m.y + ring + ORB_HIT / 2 - 4 }]}>
                <Text numberOfLines={1} style={styles.name}>
                  {truncateName(p.name)}
                </Text>
                <Text style={styles.distance}>{formatDistance(p.distanceMeters)}</Text>
              </View>
              {p.orbs.map((orb, i) => {
                const a = (2 * Math.PI * i) / p.orbs.length;
                return (
                  <Pressable
                    key={orb.id}
                    testID={`ar-orb-${orb.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={orbLabel(orb)}
                    onPress={() => onPressOrb(orb.id)}
                    style={[
                      styles.orbHit,
                      { left: m.x + ring * Math.sin(a) - ORB_HIT / 2, top: m.y - ring * Math.cos(a) - ORB_HIT / 2 },
                    ]}
                  >
                    <View style={[styles.orb, { shadowColor: p.color }]} />
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      {markers.map((m) => {
        if (m.onScreen) return null;
        const p = byId.get(m.id)!;
        const top = viewport.height * EDGE_TOP + edge[m.side]++ * EDGE_STEP;
        const arrow = m.side === 'left' ? '‹' : '›';
        return (
          <Pressable
            key={m.id}
            testID={`ar-edge-${m.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}, ${formatDistance(p.distanceMeters)}, to your ${m.side}`}
            onPress={() => onPressPlace(m.id)}
            style={[styles.edge, m.side === 'left' ? { left: 8 } : { right: 8 }, { top }]}
          >
            <View style={[styles.edgeDot, { backgroundColor: p.color }]} />
            <Text numberOfLines={1} style={styles.edgeText}>
              {m.side === 'left' ? `${arrow} ` : ''}
              {truncateName(p.name)} · {formatDistance(p.distanceMeters)}
              {m.side === 'right' ? ` ${arrow}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: '#000' },
  hint: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    color: colors.text,
    backgroundColor: 'rgba(13,17,23,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  aura: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(240,246,252,0.8)',
    shadowOpacity: 0.9,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  label: { position: 'absolute', width: 140, alignItems: 'center' },
  name: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
    textShadowColor: '#000',
    textShadowRadius: 4,
  },
  distance: { color: colors.text, fontSize: 11, textShadowColor: '#000', textShadowRadius: 4 },
  orbHit: { position: 'absolute', width: ORB_HIT, height: ORB_HIT, alignItems: 'center', justifyContent: 'center' },
  orb: {
    width: ORB_DOT,
    height: ORB_DOT,
    borderRadius: ORB_DOT / 2,
    backgroundColor: colors.text,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  edge: {
    position: 'absolute',
    maxWidth: '60%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,17,23,0.75)',
    borderRadius: 22,
    paddingHorizontal: 12,
  },
  edgeDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  edgeText: { color: colors.text, fontSize: 13, flexShrink: 1 },
});
