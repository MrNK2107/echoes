import type { Memory, PrivacyType } from './types';

/**
 * Mirrors firestore.rules `isVisibleMemory` plus the author's own-read clause. A memory hidden by
 * moderation (ADR-0008) stays visible to its author only. `moderation` is optional so the golden
 * fixtures (which predate it) still apply.
 */
export function isMemoryVisibleTo(
  memory: Pick<Memory, 'userId' | 'privacy' | 'taggedUserIds' | 'releaseDate' | 'isDeleted'> & {
    moderation?: Memory['moderation'];
  },
  viewer: { viewerId: string; viewerIsCommunityMember: boolean; now: Date },
): boolean {
  if (memory.isDeleted) return false;
  if (viewer.viewerId === memory.userId) return true;
  if (memory.moderation === 'hidden') return false;
  switch (memory.privacy) {
    case 'public':
      return true;
    case 'private':
      return false;
    case 'tagged':
      return memory.taggedUserIds.includes(viewer.viewerId);
    case 'timeRelease':
      return memory.releaseDate !== null && viewer.now.getTime() >= memory.releaseDate.getTime();
    case 'community':
      return viewer.viewerIsCommunityMember;
  }
}

/** Ruling R24: most people one memory can tag; firestore.rules enforces the same cap. */
export const MAX_TAGS = 20;
export const TAG_CAP_ERROR = `You can tag up to ${MAX_TAGS} people.`;

export function validatePrivacy(input: {
  privacy: PrivacyType;
  taggedUserIds: string[];
  releaseDate: Date | null;
  communityId: string | null;
  now: Date;
}): string | null {
  switch (input.privacy) {
    case 'tagged':
      if (input.taggedUserIds.length === 0) return 'Add at least one tagged user.';
      return input.taggedUserIds.length > MAX_TAGS ? TAG_CAP_ERROR : null;
    case 'timeRelease':
      if (input.releaseDate === null) return 'Choose a release date.';
      return input.releaseDate.getTime() > input.now.getTime()
        ? null
        : 'Choose a future release date.';
    case 'community':
      return input.communityId === null ? 'Choose a community.' : null;
    default:
      return null;
  }
}
