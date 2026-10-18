import type { MediaRepository } from '../types';

/** Demo mode: the local URI is returned unchanged so photos render in Expo Go. */
export function createMediaRepository(): MediaRepository {
  return {
    async uploadMemoryImage({ localUri }) {
      return localUri;
    },
  };
}
