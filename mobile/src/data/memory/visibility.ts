import { isMemoryVisibleTo } from '@/domain/privacy';
import type { Memory } from '@/domain/types';
import type { Store } from './store';

/**
 * What the rules let `viewerId` read: visible memories, plus the author's own (even deleted).
 * Community membership is the members doc, as the rules' isCommunityMember checks.
 */
export function canRead(store: Store, m: Memory, viewerId: string): boolean {
  if (viewerId === m.userId) return true;
  const member = m.communityId !== null && store.isMember(m.communityId, viewerId);
  return isMemoryVisibleTo(m, { viewerId, viewerIsCommunityMember: member, now: store.now() });
}
