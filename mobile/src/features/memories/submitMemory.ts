import { emptyAura } from '@/domain/aura';
import { encodeGeohash } from '@/domain/geo';
import { validatePrivacy } from '@/domain/privacy';
import { analyzeSentiment } from '@/domain/sentiment';
import type { LatLng, Memory, Place, PrivacyType } from '@/domain/types';
import type { Services } from '@/services/services';

import { compressImage } from './compressImage';

export const PLACE_MATCH_RADIUS_METERS = 100;
export const SUBMIT_TIMEOUT_MS = 15_000;
export const MAX_MEMORY_LENGTH = 2000;

export interface MemoryDraft {
  textContent: string;
  privacy: PrivacyType;
  releaseDate: Date | null;
  taggedUserIds: string[];
  communityId: string | null;
  location: LatLng | null;
  imageUri: string | null;
}

export type SubmitResult = { ok: true; memoryId: string; placeId: string } | { ok: false; error: string };

const TIMEOUT_ERROR = 'Could not reach the server. Check your connection and try again.';
const UPLOAD_ERROR = 'Photo upload failed. Try again or remove the photo.';

class UploadError extends Error {}
class TimeoutError extends Error {}

export async function submitMemory(
  services: Services,
  userId: string,
  draft: MemoryDraft,
  deps: { compress(uri: string): Promise<string> } = { compress: compressImage },
): Promise<SubmitResult> {
  const text = draft.textContent.trim();
  if (text.length === 0) return { ok: false, error: 'Write something to remember.' };
  if (text.length > MAX_MEMORY_LENGTH) return { ok: false, error: 'Memories can be at most 2000 characters.' };

  const now = services.now();
  const privacyError = validatePrivacy({
    privacy: draft.privacy,
    taggedUserIds: draft.taggedUserIds,
    releaseDate: draft.releaseDate,
    communityId: draft.communityId,
    now,
  });
  if (privacyError) return { ok: false, error: privacyError };
  const location = draft.location;
  if (!location) return { ok: false, error: 'Capture location before saving.' };

  const memoryId = services.newId();
  const { repos } = services;

  const work = async (): Promise<{ memoryId: string; placeId: string }> => {
    let imageUrl: string | null = null;
    if (draft.imageUri) {
      try {
        const localUri = await deps.compress(draft.imageUri);
        imageUrl = await repos.media.uploadMemoryImage({ userId, memoryId, localUri });
      } catch {
        throw new UploadError();
      }
    }
    let place = await repos.places.findNearest({ center: location, radiusMeters: PLACE_MATCH_RADIUS_METERS });
    if (!place) {
      const created: Place = {
        id: services.newId(),
        name: 'Memory Place',
        latitude: location.latitude,
        longitude: location.longitude,
        geohash: encodeGeohash(location.latitude, location.longitude),
        communityId: null,
        custodianIds: [userId],
        aura: emptyAura(now),
        memoryCount: 0,
        publicMemoryCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      await repos.places.create(created);
      place = created;
    }
    const memory: Memory = {
      id: memoryId,
      userId,
      placeId: place.id,
      imageUrl,
      audioUrl: null,
      textContent: text,
      latitude: location.latitude,
      longitude: location.longitude,
      geohash: encodeGeohash(location.latitude, location.longitude),
      sentiment: analyzeSentiment(text),
      privacy: draft.privacy,
      taggedUserIds: draft.taggedUserIds,
      communityId: draft.communityId,
      releaseDate: draft.releaseDate,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await repos.memories.create(memory);
    return { memoryId, placeId: place.id };
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError()), SUBMIT_TIMEOUT_MS);
    });
    const r = await Promise.race([work(), timeout]);
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: UPLOAD_ERROR };
    if (e instanceof TimeoutError) return { ok: false, error: TIMEOUT_ERROR };
    return { ok: false, error: e instanceof Error && e.message ? e.message : TIMEOUT_ERROR };
  } finally {
    clearTimeout(timer);
  }
}
