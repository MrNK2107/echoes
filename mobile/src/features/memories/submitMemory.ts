import { emptyAura } from '@/domain/aura';
import { encodeGeohash } from '@/domain/geo';
import { MAX_MEMORY_LENGTH, validateMemoryText } from '@/domain/memoryLifecycle';
import { validatePrivacy } from '@/domain/privacy';
import { analyzeSentiment } from '@/domain/sentiment';
import type { LatLng, Memory, Place, PrivacyType } from '@/domain/types';
import type { Services } from '@/services/services';

import { compressImage } from './compressImage';

export const PLACE_MATCH_RADIUS_METERS = 100;
export const SUBMIT_TIMEOUT_MS = 15_000;
export { MAX_MEMORY_LENGTH };

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

const GENERIC_ERROR = 'Something went wrong. Please try again.';

class UploadError extends Error {}
class TimeoutError extends Error {}

type Deps = { compress(uri: string): Promise<string> };

/**
 * Validates the draft and starts the submit work. The returned promise never rejects: it resolves with the
 * mapped result. Ids and timestamps are minted once here, so awaiting the same promise again (after a
 * timeout) can never create a second memory.
 */
export function startSubmit(
  services: Services,
  userId: string,
  draft: MemoryDraft,
  deps: Deps = { compress: compressImage },
): Promise<SubmitResult> {
  const textError = validateMemoryText(draft.textContent);
  if (textError) return Promise.resolve({ ok: false, error: textError });
  const text = draft.textContent.trim();

  const now = services.now();
  const privacyError = validatePrivacy({
    privacy: draft.privacy,
    taggedUserIds: draft.taggedUserIds,
    releaseDate: draft.releaseDate,
    communityId: draft.communityId,
    now,
  });
  if (privacyError) return Promise.resolve({ ok: false, error: privacyError });
  const location = draft.location;
  if (!location) return Promise.resolve({ ok: false, error: 'Capture location before saving.' });

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

  return work().then(
    (r): SubmitResult => ({ ok: true, ...r }),
    (e: unknown): SubmitResult => {
      if (e instanceof UploadError) return { ok: false, error: UPLOAD_ERROR };
      console.warn('Memory submit failed', e);
      return { ok: false, error: GENERIC_ERROR };
    },
  );
}

/**
 * Waits for `work` for at most SUBMIT_TIMEOUT_MS. On timeout the work keeps running; the caller may await the
 * same promise again under a fresh timeout.
 */
export async function awaitWithTimeout(
  work: Promise<SubmitResult>,
): Promise<{ result: SubmitResult; timedOut: boolean }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError()), SUBMIT_TIMEOUT_MS);
    });
    return { result: await Promise.race([work, timeout]), timedOut: false };
  } catch {
    return { result: { ok: false, error: TIMEOUT_ERROR }, timedOut: true };
  } finally {
    clearTimeout(timer);
  }
}

export async function submitMemory(
  services: Services,
  userId: string,
  draft: MemoryDraft,
  deps: Deps = { compress: compressImage },
): Promise<SubmitResult> {
  return (await awaitWithTimeout(startSubmit(services, userId, draft, deps))).result;
}
