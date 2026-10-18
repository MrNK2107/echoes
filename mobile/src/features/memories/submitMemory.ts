import { emptyAura } from '@/domain/aura';
import { encodeGeohash } from '@/domain/geo';
import {
  MAX_MEMORY_LENGTH,
  normalizePrivacyFields,
  placeIdForNewMemory,
  validateMemoryText,
} from '@/domain/memoryLifecycle';
import { validatePrivacy } from '@/domain/privacy';
import { analyzeSentiment } from '@/domain/sentiment';
import type { LatLng, Memory, Place, PrivacyType } from '@/domain/types';
import type { Outbox, OutboxDraft } from '@/features/outbox/outbox';
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
  audioUri: string | null;
}

export type SubmitResult =
  | { ok: true; queued: false; memoryId: string; placeId: string }
  | { ok: true; queued: true; memoryId: string }
  | { ok: false; error: string };

const UPLOAD_ERROR = 'Photo upload failed. Try again or remove the photo.';
const GENERIC_ERROR = 'Something went wrong. Please try again.';

export class TimeoutError extends Error {
  constructor() {
    super('Timed out');
  }
}

/** A media upload failed; `original` is the storage error, kept for network classification. */
class MediaUploadError extends Error {
  constructor(readonly original: unknown) {
    super('Media upload failed');
  }
}

/** Errors that mean "no connection" (ADR-0006): the draft is queued instead of reported. */
export function isNetworkError(e: unknown): boolean {
  if (e instanceof MediaUploadError) return isNetworkError(e.original);
  if (e instanceof TypeError && e.message === 'Network request failed') return true;
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  return code === 'unavailable' || code === 'storage/retry-limit-exceeded';
}

/** Rejects with TimeoutError after `ms`; the timer is always cleared. The work itself keeps running. */
export async function withTimeout<T>(work: Promise<T>, ms: number = SUBMIT_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError()), ms);
    });
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Validates the form and fixes the draft's ids and timestamp once, so every replay writes the same data. */
export function prepareDraft(
  services: Services,
  userId: string,
  draft: MemoryDraft,
): { ok: true; draft: OutboxDraft } | { ok: false; error: string } {
  const textError = validateMemoryText(draft.textContent);
  if (textError) return { ok: false, error: textError };
  const now = services.now();
  const privacyError = validatePrivacy({
    privacy: draft.privacy,
    taggedUserIds: draft.taggedUserIds,
    releaseDate: draft.releaseDate,
    communityId: draft.communityId,
    now,
  });
  if (privacyError) return { ok: false, error: privacyError };
  if (!draft.location) return { ok: false, error: 'Capture location before saving.' };

  const fields = normalizePrivacyFields(draft);
  const memoryId = services.newId();
  return {
    ok: true,
    draft: {
      memoryId,
      placeIdIfNew: placeIdForNewMemory(memoryId),
      userId,
      createdAt: now.toISOString(),
      textContent: draft.textContent.trim(),
      privacy: fields.privacy,
      releaseDate: fields.releaseDate ? fields.releaseDate.toISOString() : null,
      taggedUserIds: fields.taggedUserIds,
      communityId: fields.communityId,
      location: draft.location,
      imageUri: draft.imageUri,
      audioUri: draft.audioUri,
    },
  };
}

async function upload(run: () => Promise<string>): Promise<string> {
  try {
    return await run();
  } catch (e) {
    throw new MediaUploadError(e);
  }
}

/**
 * Writes the draft. Idempotent: media go to fixed Storage paths, the place `placeIdIfNew` is created only
 * when no place lies within 100 m and it does not exist yet, and the memory is set at its fixed id with
 * identical data (an empty-diff update if it already exists).
 */
export async function runDraft(services: Services, d: OutboxDraft): Promise<{ memoryId: string; placeId: string }> {
  const { repos } = services;
  const { userId, memoryId, location } = d;
  const createdAt = new Date(d.createdAt);

  const imageUrl = d.imageUri
    ? await upload(() => repos.media.uploadMemoryImage({ userId, memoryId, localUri: d.imageUri! }))
    : null;
  const audioUrl = d.audioUri
    ? await upload(() => repos.media.uploadMemoryAudio({ userId, memoryId, localUri: d.audioUri! }))
    : null;

  let place = await repos.places.findNearest({ center: location, radiusMeters: PLACE_MATCH_RADIUS_METERS });
  if (!place) place = await repos.places.findById(d.placeIdIfNew);
  if (!place) {
    const created: Place = {
      id: d.placeIdIfNew,
      name: 'Memory Place',
      latitude: location.latitude,
      longitude: location.longitude,
      geohash: encodeGeohash(location.latitude, location.longitude),
      communityId: null,
      custodianIds: [userId],
      aura: emptyAura(createdAt),
      memoryCount: 0,
      publicMemoryCount: 0,
      createdAt,
      updatedAt: createdAt,
    };
    await repos.places.create(created);
    place = created;
  }

  const memory: Memory = {
    id: memoryId,
    userId,
    placeId: place.id,
    imageUrl,
    audioUrl,
    textContent: d.textContent,
    latitude: location.latitude,
    longitude: location.longitude,
    geohash: encodeGeohash(location.latitude, location.longitude),
    sentiment: analyzeSentiment(d.textContent),
    privacy: d.privacy,
    taggedUserIds: d.taggedUserIds,
    communityId: d.communityId,
    releaseDate: d.releaseDate ? new Date(d.releaseDate) : null,
    isDeleted: false,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
  await repos.memories.create(memory);
  return { memoryId, placeId: place.id };
}

type Deps = { compress(uri: string): Promise<string> };

/**
 * Saves the memory online within SUBMIT_TIMEOUT_MS. On timeout or a network error the draft goes to the
 * outbox (ADR-0006) and the result is `queued`. Validation and other errors are returned, never queued.
 */
export async function submitMemory(
  services: Services,
  userId: string,
  draft: MemoryDraft,
  outbox: Outbox,
  deps: Deps = { compress: compressImage },
): Promise<SubmitResult> {
  const prepared = prepareDraft(services, userId, draft);
  if (!prepared.ok) return prepared;
  let d = prepared.draft;
  if (d.imageUri) {
    try {
      d = { ...d, imageUri: await deps.compress(d.imageUri) };
    } catch (e) {
      console.warn('Image compression failed', e);
      return { ok: false, error: UPLOAD_ERROR };
    }
  }

  const work = runDraft(services, d);
  try {
    const r = await withTimeout(work);
    return { ok: true, queued: false, ...r };
  } catch (e) {
    if (e instanceof TimeoutError || isNetworkError(e)) {
      try {
        await outbox.add(d);
      } catch (queueError) {
        console.warn('Could not queue memory', queueError);
        return { ok: false, error: GENERIC_ERROR };
      }
      // A timed-out write may still land while the app is open; then the queued copy is no longer needed.
      if (e instanceof TimeoutError) {
        work.then(
          () => outbox.remove(d.memoryId).catch(() => {}),
          () => {},
        );
      }
      return { ok: true, queued: true, memoryId: d.memoryId };
    }
    if (e instanceof MediaUploadError) return { ok: false, error: UPLOAD_ERROR };
    console.warn('Memory submit failed', e);
    return { ok: false, error: GENERIC_ERROR };
  }
}
