import * as ImagePicker from 'expo-image-picker';

import type { ArRenderer, ArStatus } from './types';

interface ViroModule {
  ViroUtils?: { isARSupportedOnDevice?: (cb: (supported: boolean) => void) => void };
}

/** Optional native dependency: absent in Expo Go and until the dev build adds it. */
function loadViro(): ViroModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@reactvision/react-viro') as ViroModule;
  } catch {
    return null;
  }
}

export const expoArRenderer: ArRenderer = {
  async status(): Promise<ArStatus> {
    const viro = loadViro();
    if (!viro) return 'missing';
    const check = viro.ViroUtils?.isARSupportedOnDevice;
    if (!check) return 'available';
    return new Promise<ArStatus>((resolve) => {
      try {
        check((supported) => resolve(supported ? 'available' : 'unsupported'));
      } catch {
        resolve('unsupported');
      }
    });
  },
  async requestCamera() {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    return granted ? 'granted' : 'denied';
  },
  Scene: null,
};
