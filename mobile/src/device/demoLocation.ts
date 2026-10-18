import type { LatLng } from '@/domain/types';

import type { LocationService } from './types';

/** Memory-mode location: always granted, always at `center` (the seeded demo neighbourhood). */
export function demoLocation(center: LatLng): LocationService {
  return {
    async requestPermission() {
      return 'granted';
    },
    async getCurrentPosition() {
      return { ...center };
    },
  };
}
