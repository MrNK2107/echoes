import type { LatLng } from '@/domain/types';

export interface LocationService {
  requestPermission(): Promise<'granted' | 'denied'>;
  getCurrentPosition(): Promise<LatLng>;
}

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
  fileSize: number | null;
}

export interface ImagePickerService {
  /** null = cancelled. */
  pick(source: 'camera' | 'library'): Promise<PickedImage | null>;
}
