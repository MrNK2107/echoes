import type { Memory, PrivacyType } from './types';

export function isMemoryVisibleTo(
  memory: Pick<Memory, 'userId' | 'privacy' | 'taggedUserIds' | 'releaseDate' | 'isDeleted'>,
  viewer: { viewerId: string; viewerIsCommunityMember: boolean; now: Date },
): boolean {
  if (memory.isDeleted) return false;
  if (viewer.viewerId === memory.userId) return true;
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

export function validatePrivacy(input: {
  privacy: PrivacyType;
  taggedUserIds: string[];
  releaseDate: Date | null;
  communityId: string | null;
  now: Date;
}): string | null {
  switch (input.privacy) {
    case 'tagged':
      return input.taggedUserIds.length === 0 ? 'Add at least one tagged user.' : null;
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
