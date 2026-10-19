import { GENERIC_ERROR, PHOTO_TOO_LARGE } from '@/data/errors';
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
const AUDIO_UPLOAD_ERROR = 'Voice note upload failed. Try again or remove the voice note.';

export class TimeoutError extends Error {
  constructor() {
    super('Timed out');
  }
}

/** A media upload failed; `original` is the storage error, kept for network classification. */
class MediaUploadError extends Error {
  constructor(
    readonly original: unknown,
    readonly kind: 'image' | 'audio',
  ) {
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

const PERMANENT_CODES = new Set([
  'permission-denied',
  'invalid-argument',
  'storage/unauthorized',
  'storage/object-not-found',
]);

/** Errors a replay can never get past (ruling R14): the draft is parked instead of retried. */
export function isPermanentError(e: unknown): boolean {
  if (e instanceof MediaUploadError) return isPermanentError(e.original);
  if (e instanceof Error && e.message === PHOTO_TOO_LARGE) return true;
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  return typeof code === 'string' && PERMANENT_CODES.has(code);
}

/** A short description of an error for logs and `failedReason`. */
export function describeError(e: unknown): string {
  if (e instanceof MediaUploadError) return describeError(e.original);
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  const message = e instanceof Error ? e.message : String(e);
  return typeof code === 'string' ? `${code}: ${message}` : message;
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

const LOCATION_REQUIRED = 'Capture location before saving.';

/** The form's local checks (text, privacy, location), in the order they are reported; null when valid. */
export function validateDraft(draft: MemoryDraft, now: Date): string | null {
  const textError = validateMemoryText(draft.textContent);
  if (textError) return textError;
  const privacyError = validatePrivacy({
    privacy: draft.privacy,
    taggedUserIds: draft.taggedUserIds,
    releaseDate: draft.releaseDate,
    communityId: draft.communityId,
    now,
  });
  if (privacyError) return privacyError;
  if (!draft.location) return LOCATION_REQUIRED;
  return null;
}

/** Validates the form and fixes the draft's ids and timestamp once, so every replay writes the same data. */
export function prepareDraft(
  services: Services,
  userId: string,
  draft: MemoryDraft,
): { ok: true; draft: OutboxDraft } | { ok: false; error: string } {
  const now = services.now();
  const invalid = validateDraft(draft, now);
  if (invalid) return { ok: false, error: invalid };
  if (!draft.location) return { ok: false, error: LOCATION_REQUIRED }; // already checked; narrows the type

  const fields = normalizePrivacyFields(draft);
  const memoryId = services.newId();
  const textContent = draft.textContent.trim();
  return {
    ok: true,
    draft: {
      memoryId,
      placeIdIfNew: placeIdForNewMemory(memoryId),
      userId,
      createdAt: now.toISOString(),
      textContent,
      privacy: fields.privacy,
      releaseDate: fields.releaseDate ? fields.releaseDate.toISOString() : null,
      taggedUserIds: fields.taggedUserIds,
      communityId: fields.communityId,
      location: draft.location,
      imageUri: draft.imageUri,
      audioUri: draft.audioUri,
      sentiment: analyzeSentiment(textContent),
    },
  };
}

async function upload(kind: 'image' | 'audio', run: () => Promise<string>): Promise<string> {
  try {
    return await run();
  } catch (e) {
    throw new MediaUploadError(e, kind);
  }
}

/**
 * Writes the draft. Idempotent: if the memory already exists (even soft-deleted or edited since) nothing
 * is rewritten; at most missing media are attached. Otherwise media go to fixed Storage paths, the place
 * `placeIdIfNew` is created only when no place lies within 100 m and it does not exist yet, and the memory
 * is set at its fixed id.
 */
export async function runDraft(services: Services, d: OutboxDraft): Promise<{ memoryId: string; placeId: string }> {
  const { repos } = services;
  const { userId, memoryId, location } = d;
  const createdAt = new Date(d.createdAt);
  const uploadImage = () =>
    upload('image', () => repos.media.uploadMemoryImage({ userId, memoryId, localUri: d.imageUri! }));
  const uploadAudio = () =>
    upload('audio', () => repos.media.uploadMemoryAudio({ userId, memoryId, localUri: d.audioUri! }));

  const existing = await repos.memories.findById(memoryId);
  if (existing) {
    if (!existing.isDeleted) {
      const media: { imageUrl?: string; audioUrl?: string } = {};
      if (d.imageUri && !existing.imageUrl) media.imageUrl = await uploadImage();
      if (d.audioUri && !existing.audioUrl) media.audioUrl = await uploadAudio();
      if (media.imageUrl || media.audioUrl) await repos.memories.attachMedia(memoryId, media, services.now());
    }
    return { memoryId, placeId: existing.placeId };
  }

  const imageUrl = d.imageUri ? await uploadImage() : null;
  const audioUrl = d.audioUri ? await uploadAudio() : null;

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
    sentiment: d.sentiment ?? analyzeSentiment(d.textContent),
    privacy: d.privacy,
    taggedUserIds: d.taggedUserIds,
    communityId: d.communityId,
    releaseDate: d.releaseDate ? new Date(d.releaseDate) : null,
    isDeleted: false,
    deletedAt: null,
    moderation: null,
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

  // The processor skips this draft while the original attempt is still running.
  const memoryId = d.memoryId;
  outbox.markInFlight(memoryId);
  let queued = false;
  const work = runDraft(services, d);
  void work
    .then(
      // A timed-out write may still land while the app is open; then the queued copy is no longer needed.
      () => (queued ? outbox.remove(memoryId) : undefined),
      () => {},
    )
    .catch(() => {})
    .finally(() => outbox.clearInFlight(memoryId));
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
      queued = true;
      return { ok: true, queued: true, memoryId };
    }
    if (e instanceof MediaUploadError) {
      return { ok: false, error: e.kind === 'audio' ? AUDIO_UPLOAD_ERROR : UPLOAD_ERROR };
    }
    console.warn('Memory submit failed', e);
    return { ok: false, error: GENERIC_ERROR };
  }
}
