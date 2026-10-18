import { getDownloadURL, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import type { MediaRepository } from '../types';

async function upload(
  storage: FirebaseStorage,
  path: string,
  localUri: string,
  contentType: string,
): Promise<string> {
  const blob = await (await fetch(localUri)).blob();
  const target = ref(storage, path);
  await uploadBytes(target, blob, { contentType });
  return getDownloadURL(target);
}

export function createMediaRepository(storage: FirebaseStorage): MediaRepository {
  return {
    uploadMemoryImage({ userId, memoryId, localUri }) {
      return upload(storage, `memory-images/${userId}/${memoryId}.jpg`, localUri, 'image/jpeg');
    },
    uploadMemoryAudio({ userId, memoryId, localUri }) {
      return upload(storage, `memory-audio/${userId}/${memoryId}.m4a`, localUri, 'audio/mp4');
    },
  };
}
