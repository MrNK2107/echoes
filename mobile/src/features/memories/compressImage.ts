import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { PHOTO_TOO_LARGE } from '@/data/errors';

export const UPLOAD_LIMIT_BYTES = 1_048_576;
const START_WIDTH = 1600;
const MIN_WIDTH = 400;
const START_QUALITY = 0.7;
const MIN_QUALITY = 0.25;
const QUALITY_STEP = 0.15;

export interface CompressDeps {
  manipulate(uri: string, opts: { width: number; quality: number }): Promise<{ uri: string }>;
  sizeOf(uri: string): Promise<number>;
}

const defaultDeps: CompressDeps = {
  async manipulate(uri, { width, quality }) {
    const ref = await ImageManipulator.manipulate(uri).resize({ width }).renderAsync();
    return ref.saveAsync({ compress: quality, format: SaveFormat.JPEG });
  },
  async sizeOf(uri) {
    return new File(uri).size;
  },
};

/** Resizes and re-encodes a photo until it fits the upload limit; returns the final local uri. */
export async function compressImage(uri: string, deps: CompressDeps = defaultDeps): Promise<string> {
  let width = START_WIDTH;
  let quality = START_QUALITY;
  for (;;) {
    const out = await deps.manipulate(uri, { width, quality });
    if ((await deps.sizeOf(out.uri)) <= UPLOAD_LIMIT_BYTES) return out.uri;
    if (quality - QUALITY_STEP >= MIN_QUALITY - 1e-9) {
      quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
    } else {
      width = Math.floor(width / 2);
      if (width < MIN_WIDTH) throw new Error(PHOTO_TOO_LARGE);
    }
  }
}
