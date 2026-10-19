import * as Location from 'expo-location';

import type { HeadingService } from './types';

export const expoHeading: HeadingService = {
  async subscribe(cb) {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) throw new Error('location permission not granted');
    const sub = await Location.watchHeadingAsync((h) => cb(h.trueHeading >= 0 ? h.trueHeading : h.magHeading));
    return () => sub.remove();
  },
};
