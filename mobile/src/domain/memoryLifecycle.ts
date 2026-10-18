import type { Memory, PrivacyType } from './types';

export const RESTORE_WINDOW_DAYS = 30;
export const MAX_MEMORY_LENGTH = 2000;

const DAY_MS = 24 * 60 * 60 * 1000;

type DeletionState = Pick<Memory, 'isDeleted' | 'deletedAt'>;

function restoreDeadline(m: DeletionState): number | null {
  if (!m.isDeleted || m.deletedAt === null) return null;
  return m.deletedAt.getTime() + RESTORE_WINDOW_DAYS * DAY_MS;
}

export function restoreDaysLeft(m: DeletionState, now: Date): number {
  const deadline = restoreDeadline(m);
  if (deadline === null) return 0;
  return Math.max(0, Math.ceil((deadline - now.getTime()) / DAY_MS));
}

export function canRestore(m: DeletionState, now: Date): boolean {
  const deadline = restoreDeadline(m);
  return deadline !== null && now.getTime() < deadline;
}

export function validateMemoryText(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'Write something to remember.';
  if (trimmed.length > MAX_MEMORY_LENGTH) return `Memories can be at most ${MAX_MEMORY_LENGTH} characters.`;
  return null;
}

export function placeIdForNewMemory(memoryId: string): string {
  return 'p_' + memoryId;
}

interface PrivacyFields {
  privacy: PrivacyType;
  taggedUserIds: string[];
  releaseDate: Date | null;
  communityId: string | null;
}

export function normalizePrivacyFields(input: PrivacyFields): PrivacyFields {
  return {
    privacy: input.privacy,
    taggedUserIds: input.privacy === 'tagged' ? input.taggedUserIds : [],
    releaseDate: input.privacy === 'timeRelease' ? input.releaseDate : null,
    communityId: input.privacy === 'community' ? input.communityId : null,
  };
}
