import { getDownloadURL, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import type { MediaRepository } from '../types';

export function createMediaRepository(storage: FirebaseStorage): MediaRepository {
  return {
    async uploadMemoryImage({ userId, memoryId, localUri }) {
      const blob = await (await fetch(localUri)).blob();
      const target = ref(storage, `memory-images/${userId}/${memoryId}.jpg`);
      await uploadBytes(target, blob, { contentType: 'image/jpeg' });
      return getDownloadURL(target);
    },
  };
}
