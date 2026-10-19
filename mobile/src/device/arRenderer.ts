import type { ComponentType } from 'react';
import { Platform } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';

import { createCameraArScene } from './ar/CameraArScene';
import type { ArRenderer, ArSceneProps, ArStatus } from './types';

/** ~30 Hz attitude updates: smooth enough for the overlay, light on the battery. */
const MOTION_INTERVAL_MS = 33;

async function declination(): Promise<number> {
  // The rotation sensor references magnetic north; places use true bearings.
  const h = await Location.getHeadingAsync();
  return h.trueHeading >= 0 && h.magHeading >= 0 ? h.trueHeading - h.magHeading : 0;
}

let sceneMemo: ComponentType<ArSceneProps> | null | undefined;

/**
 * Location-based camera AR (ADR-0010, amended): the live camera preview with place auras and
 * memory orbs projected from GPS bearing, distance and the fused attitude sensor. It uses only
 * modules that ship in Expo Go and every build, so it needs no ARCore or ARKit.
 */
export const expoArRenderer: ArRenderer = {
  async status(): Promise<ArStatus> {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'unsupported';
    try {
      if (!(await DeviceMotion.isAvailableAsync())) return 'unsupported';
    } catch {
      return 'unsupported';
    }
    try {
      if (!(await CameraView.isAvailableAsync())) return 'unsupported';
    } catch {
      // Not implemented on every native platform; the preview reports mount errors itself.
    }
    return 'available';
  },
  async requestCamera() {
    const { granted } = await Camera.requestCameraPermissionsAsync();
    return granted ? 'granted' : 'denied';
  },
  get Scene(): ComponentType<ArSceneProps> | null {
    if (sceneMemo === undefined) {
      sceneMemo =
        Platform.OS === 'ios' || Platform.OS === 'android'
          ? createCameraArScene({
              CameraView,
              platform: Platform.OS,
              declination,
              subscribeMotion(cb) {
                DeviceMotion.setUpdateInterval(MOTION_INTERVAL_MS);
                const sub = DeviceMotion.addListener((m) => {
                  if (m.rotation) cb(m.rotation);
                });
                return () => sub.remove();
              },
            })
          : null;
    }
    return sceneMemo;
  },
};
